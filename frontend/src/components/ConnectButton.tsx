import { ConnectButton as ArweaveConnectButton } from "@arweave-wallet-kit/react";
import "./ConnectButton.css";
import { ConnectButton as EvmConnectButton } from '@rainbow-me/rainbowkit';

const ConnectButton = () => {
  return (
    <div>
      <ArweaveConnectButton
        showBalance={true}
        showProfilePicture={false}
        profileModal={true}
        className="custom-connect-button"
      />

      {/* <EvmConnectButton /> */}

    </div>
  );
};
export default ConnectButton;
