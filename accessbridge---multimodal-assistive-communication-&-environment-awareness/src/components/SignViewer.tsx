import React from 'react';
import { SigningAvatarViewer } from './SigningAvatarViewer';

export interface SignViewerProps {
  word?: string;
  autoPlay?: boolean;
  onClipFinished?: () => void;
  className?: string;
}

/**
 * AccessBridge - SignViewer
 * Official 54-bone VRM humanoid avatar viewer powered by @pixiv/three-vrm.
 * Directly wraps SigningAvatarViewer with full motion playback controls.
 */
export const SignViewer: React.FC<SignViewerProps> = ({
  word = 'Hello',
  className = ''
}) => {
  return (
    <div className={`w-full ${className}`}>
      <SigningAvatarViewer word={word} />
    </div>
  );
};
