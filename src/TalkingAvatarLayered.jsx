import { useEffect, useState } from "react";
import base from "./avatar/base.png";

const overlayAssets = import.meta.glob("./avatar/*-overlay.png", {
  eager: true,
  import: "default",
});

const mouthOpenOverlay = overlayAssets["./avatar/mouth-open-overlay.png"];
const mouthWideOverlay = overlayAssets["./avatar/mouth-wide-overlay.png"];
const mouthOOverlay = overlayAssets["./avatar/mouth-o-overlay.png"];
const eyesClosedOverlay = overlayAssets["./avatar/eyes-closed-overlay.png"];

const MOUTH_STYLE = {
  position: "absolute",
  left: "50%",
  top: "54%",
  width: "18%",
  transform: "translateX(-50%)",
  opacity: 0,
  transition: "opacity 120ms ease",
  pointerEvents: "none",
};

const EYES_STYLE = {
  position: "absolute",
  left: "50%",
  top: "30%",
  width: "34%",
  transform: "translateX(-50%)",
  opacity: 0,
  transition: "opacity 120ms ease",
  pointerEvents: "none",
};

const mouthFrames = [mouthOpenOverlay, mouthWideOverlay, mouthOOverlay].filter(Boolean);

export default function TalkingAvatarLayered({ speaking, thinking, listening }) {
  const [currentMouthFrame, setCurrentMouthFrame] = useState(mouthFrames[0] || null);
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    if (!speaking || mouthFrames.length === 0) {
      setCurrentMouthFrame(null);
      return undefined;
    }

    let frameIndex = 0;
    setCurrentMouthFrame(mouthFrames[frameIndex]);

    const intervalId = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % mouthFrames.length;
      setCurrentMouthFrame(mouthFrames[frameIndex]);
    }, 170);

    return () => window.clearInterval(intervalId);
  }, [speaking]);

  useEffect(() => {
    let blinkTimeoutId;
    let eyesOpenTimeoutId;

    const scheduleBlink = () => {
      blinkTimeoutId = window.setTimeout(() => {
        setIsBlinking(true);

        eyesOpenTimeoutId = window.setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 120);
      }, 3000 + Math.random() * 2000);
    };

    scheduleBlink();

    return () => {
      window.clearTimeout(blinkTimeoutId);
      window.clearTimeout(eyesOpenTimeoutId);
    };
  }, []);

  const frameFilter = thinking
    ? "drop-shadow(0 0 22px rgba(167, 139, 250, 0.28))"
    : listening
      ? "drop-shadow(0 0 18px rgba(59, 130, 246, 0.24))"
      : speaking
        ? "drop-shadow(0 0 16px rgba(16, 185, 129, 0.18))"
        : "drop-shadow(0 10px 24px rgba(15, 23, 42, 0.14))";

  return (
    <>
      <style>
        {`
          @keyframes talking-avatar-layered-float {
            0%,
            100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-4px);
            }
          }
        `}
      </style>
      <div
        style={{
          width: "300px",
          maxWidth: "100%",
          aspectRatio: "2 / 3",
          margin: "0 auto",
          position: "relative",
          borderRadius: "16px",
          overflow: "hidden",
          filter: frameFilter,
          animation: "talking-avatar-layered-float 4.8s ease-in-out infinite",
        }}
      >
        <img
          src={base}
          alt="Female doctor avatar"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "cover",
          }}
        />

        {currentMouthFrame && (
          <img
            src={currentMouthFrame}
            alt=""
            aria-hidden="true"
            style={{
              ...MOUTH_STYLE,
              opacity: speaking ? 1 : 0,
            }}
          />
        )}

        {eyesClosedOverlay && (
          <img
            src={eyesClosedOverlay}
            alt=""
            aria-hidden="true"
            style={{
              ...EYES_STYLE,
              opacity: isBlinking ? 1 : 0,
            }}
          />
        )}
      </div>
    </>
  );
}
