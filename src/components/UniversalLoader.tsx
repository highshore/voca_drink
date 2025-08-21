import styled, { keyframes } from "styled-components";
import { LottieByUrl } from "../ui/AnimatedEmoji";
import { colors } from "../ui/layout";

interface UniversalLoaderProps {
  message?: string;
  size?: number;
  animationUrl?: string;
}

const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-8px);
  }
  60% {
    transform: translateY(-4px);
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const LoaderOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${colors.white};
  z-index: 9999;
  animation: ${fadeIn} 0.3s ease-out;
`;

const LoaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  animation: ${fadeIn} 0.5s ease-out 0.2s both;
`;

const PlayfulMessage = styled.div`
  color: ${colors.text};
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: 0.02em;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: linear-gradient(
    45deg,
    ${colors.brand},
    #ff6b6b,
    #4ecdc4,
    ${colors.brand}
  );
  background-size: 300% 300%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${bounce} 2s infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: ${colors.brand};
    background-clip: unset;
    -webkit-background-clip: unset;
    -webkit-text-fill-color: unset;
    color: ${colors.brand};
  }
`;

export function UniversalLoader({
  message = "Loading…",
  size = 140,
  animationUrl = "https://fonts.gstatic.com/s/e/notoemoji/latest/1fad7/lottie.json",
}: UniversalLoaderProps) {
  return (
    <LoaderOverlay>
      <LoaderContainer>
        <LottieByUrl src={animationUrl} size={size} />
        <PlayfulMessage>{message}</PlayfulMessage>
      </LoaderContainer>
    </LoaderOverlay>
  );
}
