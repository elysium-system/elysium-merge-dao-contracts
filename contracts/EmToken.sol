//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

contract EmToken is
    Context,
    AccessControlEnumerable,
    ERC1155,
    ERC1155Burnable,
    ERC1155Supply
{
    uint256 public constant OG_TOKEN_ID = 0;
    uint256 public constant FOUNDER_TOKEN_ID = 1;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    Merge public immutable merge;

    address public vault;

    bool public isOgTokenClaimingEnabled;
    bool public isFounderTokenClaimingEnabled;
    bool public isFounderTokenMintingEnabled;

    mapping(address => uint256) public addressToNumClaimableOgTokens;
    mapping(address => uint256) public addressToNumClaimableFounderTokens;

    event OgTokenClaimed(address indexed to, uint256 qty);
    event FounderTokenClaimed(address indexed to, uint256 qty);
    event FounderTokenMinted(address indexed to, uint256 qty);

    constructor(
        string memory uri,
        address merge_,
        address vault_
    ) ERC1155(uri) {
        merge = Merge(merge_);
        vault = vault_;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ADMIN_ROLE, _msgSender());

        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    }

    function setVault(address vault_) external onlyRole(ADMIN_ROLE) {
        vault = vault_;
    }

    function setUri(string memory uri) external onlyRole(ADMIN_ROLE) {
        _setURI(uri);
    }

    function toggleOgTokenClaiming() external onlyRole(ADMIN_ROLE) {
        isOgTokenClaimingEnabled = !isOgTokenClaimingEnabled;
    }

    function toggleFounderTokenClaiming() external onlyRole(ADMIN_ROLE) {
        isFounderTokenClaimingEnabled = !isFounderTokenClaimingEnabled;
    }

    function toggleFounderTokenMinting() external onlyRole(ADMIN_ROLE) {
        isFounderTokenMintingEnabled = !isFounderTokenMintingEnabled;
    }

    function setNumClaimableOgTokensForAddresses(
        address[] calldata addresses,
        uint256[] calldata numClaimableTokenss
    ) external onlyRole(ADMIN_ROLE) {
        require(
            numClaimableTokenss.length == addresses.length,
            "Lengths are not equal"
        );

        uint256 numAddresses = addresses.length;
        for (uint256 i = 0; i < numAddresses; ++i) {
            addressToNumClaimableOgTokens[addresses[i]] = numClaimableTokenss[
                i
            ];
        }
    }

    function setNumClaimableFounderTokensForAddresses(
        address[] calldata addresses,
        uint256[] calldata numClaimableTokenss
    ) external onlyRole(ADMIN_ROLE) {
        require(
            numClaimableTokenss.length == addresses.length,
            "Lengths are not equal"
        );

        uint256 numAddresses = addresses.length;
        for (uint256 i = 0; i < numAddresses; ++i) {
            addressToNumClaimableFounderTokens[
                addresses[i]
            ] = numClaimableTokenss[i];
        }
    }

    function claimAll(address to) external {
        require(
            isOgTokenClaimingEnabled && isFounderTokenClaimingEnabled,
            "Not enabled"
        );

        uint256 ogTokenQty = addressToNumClaimableOgTokens[to];
        addressToNumClaimableOgTokens[to] = 0;

        uint256 founderTokenQty = addressToNumClaimableFounderTokens[to];
        addressToNumClaimableFounderTokens[to] = 0;

        uint256[] memory tokenIds = new uint256[](2);
        uint256[] memory tokenQtys = new uint256[](2);
        tokenIds[0] = OG_TOKEN_ID;
        tokenQtys[0] = ogTokenQty;
        tokenIds[1] = FOUNDER_TOKEN_ID;
        tokenQtys[1] = founderTokenQty;

        _mintBatch(to, tokenIds, tokenQtys, "");

        emit OgTokenClaimed(to, ogTokenQty);
        emit FounderTokenClaimed(to, founderTokenQty);
    }

    function claimOgToken(address to) external {
        require(isOgTokenClaimingEnabled, "Not enabled");

        uint256 qty = addressToNumClaimableOgTokens[to];
        addressToNumClaimableOgTokens[to] = 0;

        _mint(to, OG_TOKEN_ID, qty, "");

        emit OgTokenClaimed(to, qty);
    }

    function claimFounderToken(address to) external {
        require(isFounderTokenClaimingEnabled, "Not enabled");

        uint256 qty = addressToNumClaimableFounderTokens[to];
        addressToNumClaimableFounderTokens[to] = 0;

        _mint(to, FOUNDER_TOKEN_ID, qty, "");

        emit FounderTokenClaimed(to, qty);
    }

    function mintFounderToken(address to, uint256 mergeId) external {
        require(isFounderTokenMintingEnabled, "Not enabled");

        uint256 mass = merge.massOf(mergeId);
        require(mass <= merge.massOf(merge.tokenOf(vault)), "Too big");

        merge.safeTransferFrom(merge.ownerOf(mergeId), vault, mergeId);

        _mint(to, FOUNDER_TOKEN_ID, mass, "");

        emit FounderTokenMinted(to, mass);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlEnumerable, ERC1155)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155, ERC1155Supply) {
        return
            super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}

contract Merge {
    function ownerOf(uint256 tokenId) public view returns (address owner) {}

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public {}

    function massOf(uint256 tokenId) public view returns (uint256) {}

    function getValueOf(uint256 tokenId) public view returns (uint256) {}

    function decodeClass(uint256 value) public pure returns (uint256) {}

    function decodeMass(uint256 value) public pure returns (uint256) {}

    function tokenOf(address owner) public view returns (uint256) {}
}
