// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MissionEV v2 — PROPOSED. NOT DEPLOYED. Do not point the app at a v2 address without explicit approval.
 *
 * Differences from the contract in ../MissionEV.sol (every other line is intentionally identical, and the
 * `recordCommute` ABI, enum numbering and EIP-712 payload are unchanged, so the oracle and front end need no changes):
 *
 *  1. Constructor rejects a zero oracle address. In v1 a zero oracle makes `ecrecover`'s failure value (address(0))
 *     equal the stored signer, so ANY garbage signature would mint rewards.
 *  2. `recordCommute` requires a 65-byte signature (v1 reads 65 bytes from calldata whatever the length).
 *  3. Signature recovery rejects high-s values (malleable twins) and v other than 27/28, and a zero recovered address.
 *  4. `transfer` and `mint` refuse the zero address (v1 lets tokens be "sent" to address(0) and lost).
 *  5. `transferFrom` added, so `approve`/`allowance` actually do something and the token is a complete ERC-20.
 *  6. BEHAVIOUR CHANGE (needs product approval): the mode bonus is paid only when `co2AvoidedGrams > 0`. In v1 an EV,
 *     metro or walking trip with 0 avoided grams still mints 10-15 MEV.
 *
 * Deploying v2 means a NEW address: v1 balances, nonces, streaks and processed trip ids do not carry over.
 */
contract MissionEVv2 {
    string public constant name = "MissionEV Carbon Reward";
    string public constant symbol = "MEV";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner;
    address public azureOracleSigner;

    struct CommuterProfile {
        uint256 carbonScore;
        uint256 streakDays;
        uint256 lastTripTimestamp;
        uint256 totalAvoidedGramsCO2;
        uint256 totalTripsLogged;
    }

    enum TransportMode {
        EV_CAR,      // 0
        EV_2W,       // 1
        METRO,       // 2
        EBUS,        // 3
        ACTIVE,      // 4 (Walk/Cycle)
        ICE_CAR,     // 5
        ICE_SUV      // 6
    }

    mapping(address => CommuterProfile) public commuters;
    mapping(bytes32 => bool) public processedTrips;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant TRIP_TYPEHASH = keccak256(
        "TripPayload(address commuter,bytes32 tripId,uint8 mode,uint32 distanceMeters,uint32 co2AvoidedGrams,uint256 nonce,uint256 deadline)"
    );
    mapping(address => uint256) public nonces;

    /// @dev Upper bound for s: half the secp256k1 curve order (EIP-2).
    uint256 private constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event CommuteVerified(
        address indexed commuter,
        bytes32 indexed tripId,
        TransportMode mode,
        uint32 distanceMeters,
        uint32 co2AvoidedGrams,
        uint256 pointsMinted,
        uint256 newCarbonScore
    );
    event StreakUpdated(address indexed commuter, uint256 newStreak);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    modifier onlyOwner() {
        require(msg.sender == owner, "MissionEV: Only owner");
        _;
    }

    constructor(address _azureOracleSigner) {
        require(_azureOracleSigner != address(0), "MissionEV: Invalid oracle address"); // (1)
        owner = msg.sender;
        azureOracleSigner = _azureOracleSigner;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MissionEV")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function setAzureOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "MissionEV: Invalid oracle address");
        emit OracleUpdated(azureOracleSigner, _newOracle);
        azureOracleSigner = _newOracle;
    }

    function recordCommute(
        bytes32 tripId,
        TransportMode mode,
        uint32 distanceMeters,
        uint32 co2AvoidedGrams,
        uint256 deadline,
        bytes calldata sig
    ) external {
        require(block.timestamp <= deadline, "MissionEV: Signature expired");
        require(!processedTrips[tripId], "MissionEV: Trip already processed");
        require(sig.length == 65, "MissionEV: Bad signature length"); // (2)

        address commuter = msg.sender;
        uint256 currentNonce = nonces[commuter]++;

        _verifyOracleSignature(commuter, tripId, mode, distanceMeters, co2AvoidedGrams, currentNonce, deadline, sig);

        processedTrips[tripId] = true;

        CommuterProfile storage profile = commuters[commuter];

        _updateStreak(profile);
        profile.lastTripTimestamp = block.timestamp;
        profile.totalTripsLogged += 1;
        profile.totalAvoidedGramsCO2 += co2AvoidedGrams;

        uint256 rewardAmount = _computeReward(profile.streakDays, mode, co2AvoidedGrams);
        _updateScore(profile, co2AvoidedGrams);

        if (rewardAmount > 0) {
            _mint(commuter, rewardAmount);
        }

        emit CommuteVerified(commuter, tripId, mode, distanceMeters, co2AvoidedGrams, rewardAmount / 1e18, profile.carbonScore);
        emit StreakUpdated(commuter, profile.streakDays);
    }

    function _verifyOracleSignature(
        address commuter,
        bytes32 tripId,
        TransportMode mode,
        uint32 distanceMeters,
        uint32 co2AvoidedGrams,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) internal view {
        bytes32 structHash = keccak256(
            abi.encode(TRIP_TYPEHASH, commuter, tripId, uint8(mode), distanceMeters, co2AvoidedGrams, nonce, deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        require(uint256(s) <= HALF_N, "MissionEV: Invalid signature s"); // (3)
        require(v == 27 || v == 28, "MissionEV: Invalid signature v");

        address recoveredSigner = ecrecover(digest, v, r, s);
        require(recoveredSigner != address(0) && recoveredSigner == azureOracleSigner, "MissionEV: Invalid oracle signature");
    }

    function _updateStreak(CommuterProfile storage profile) internal {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 lastTripDay = profile.lastTripTimestamp / 1 days;

        if (profile.lastTripTimestamp == 0) {
            profile.streakDays = 1;
        } else if (currentDay == lastTripDay + 1) {
            profile.streakDays += 1;
        } else if (currentDay > lastTripDay + 1) {
            profile.streakDays = 1;
        }
    }

    function _computeReward(uint256 streakDays, TransportMode mode, uint32 co2AvoidedGrams)
        internal
        pure
        returns (uint256)
    {
        uint256 streakMultiplierBps = 10000;
        if (streakDays >= 20) {
            streakMultiplierBps = 30000;
        } else if (streakDays >= 10) {
            streakMultiplierBps = 20000;
        } else if (streakDays >= 5) {
            streakMultiplierBps = 15000;
        }

        uint256 baseTokens = (uint256(co2AvoidedGrams) * 20 * 1e18) / 1000;
        uint256 rewardAmount = (baseTokens * streakMultiplierBps) / 10000;

        // (6) No avoided carbon, no mode bonus.
        if (co2AvoidedGrams > 0) {
            if (mode == TransportMode.ACTIVE) {
                rewardAmount += 15 * 1e18;
            } else if (mode == TransportMode.EV_CAR || mode == TransportMode.EV_2W || mode == TransportMode.METRO) {
                rewardAmount += 10 * 1e18;
            }
        }

        return rewardAmount;
    }

    function _updateScore(CommuterProfile storage profile, uint256 co2AvoidedGrams) internal {
        if (profile.carbonScore == 0) profile.carbonScore = 500;
        if (co2AvoidedGrams > 2000) {
            profile.carbonScore = min(1000, profile.carbonScore + 8);
        } else if (co2AvoidedGrams > 500) {
            profile.carbonScore = min(1000, profile.carbonScore + 4);
        } else {
            profile.carbonScore = min(1000, profile.carbonScore + 2);
        }
    }

    function getCommuter(address commuter) external view returns (
        uint256 carbonScore,
        uint256 streakDays,
        uint256 lastTripTimestamp,
        uint256 totalAvoidedGramsCO2,
        uint256 totalTripsLogged,
        uint256 tokenBalance
    ) {
        CommuterProfile memory p = commuters[commuter];
        return (p.carbonScore, p.streakDays, p.lastTripTimestamp, p.totalAvoidedGramsCO2, p.totalTripsLogged, balanceOf[commuter]);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ERC20: mint to zero address"); // (4)
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) { // (5)
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ERC20: Insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ERC20: transfer to zero address"); // (4)
        require(balanceOf[from] >= amount, "ERC20: Insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
