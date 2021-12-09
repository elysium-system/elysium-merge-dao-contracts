//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

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
    address private _vault;

    Merge public merge;

    uint256 public constant OG_TOKEN_ID = 0;
    uint256 public constant FOUNDER_TOKEN_ID = 1;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    bool public isClaimingEnabled = false;
    bool public isMintingEnabled = false;

    mapping(address => uint256) public addressToNumClaimableOgTokens;

    event OgTokenClaimed(address indexed to, uint256 qty);
    event FounderTokenMinted(address indexed to, uint256 qty);

    constructor(string memory uri, address vault) ERC1155(uri) {
        _vault = vault;

        merge = Merge(0x27d270B7d58D15D455c85c02286413075f3C8a31);

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ADMIN_ROLE, _msgSender());

        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    }

    function setVault(address vault) external onlyRole(ADMIN_ROLE) {
        _vault = vault;
    }

    function setUri(string memory uri) external onlyRole(ADMIN_ROLE) {
        _setURI(uri);
    }

    function toggleIsClaimingEnabled() external onlyRole(ADMIN_ROLE) {
        isClaimingEnabled = !isClaimingEnabled;
    }

    function toggleIsMintingEnabled() external onlyRole(ADMIN_ROLE) {
        isMintingEnabled = !isMintingEnabled;
    }

    function setNumClaimableOgTokensForAddresses(
        address[] calldata addresses,
        uint256[] calldata numClaimableTokenss
    ) external onlyRole(ADMIN_ROLE) {
        require(
            numClaimableTokenss.length == addresses.length,
            "Lengths not match"
        );

        uint256 numAddresses = addresses.length;
        for (uint256 i = 0; i < numAddresses; ++i) {
            addressToNumClaimableOgTokens[addresses[i]] = numClaimableTokenss[
                i
            ];
        }
    }

    function claimOgToken(address to, uint256 qty) external {
        require(isClaimingEnabled, "Not enabled");
        require(qty <= addressToNumClaimableOgTokens[to], "Not enough quota");

        addressToNumClaimableOgTokens[to] -= qty;

        _mint(to, OG_TOKEN_ID, qty, "");
    }

    function mintFounderToken(address to, uint256 mergeId) external {
        require(isMintingEnabled, "Not enabled");

        uint256 mass = merge.massOf(mergeId);
        require(mass <= merge.massOf(merge.tokenOf(_vault)), "Too big");

        merge.safeTransferFrom(merge.ownerOf(mergeId), _vault, mergeId);

        _mint(to, FOUNDER_TOKEN_ID, mass, "");
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

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlEnumerable, ERC1155)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

contract Merge {
    function ownerOf(uint256 tokenId) external view returns (address owner) {}

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external {}

    function massOf(uint256 tokenId) public view virtual returns (uint256) {}

    function getValueOf(uint256 tokenId)
        public
        view
        virtual
        returns (uint256)
    {}

    function decodeClass(uint256 value) public pure returns (uint256) {}

    function decodeMass(uint256 value) public pure returns (uint256) {}

    function tokenOf(address owner) public view virtual returns (uint256) {}
}
