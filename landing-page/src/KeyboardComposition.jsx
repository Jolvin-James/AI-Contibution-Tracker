import React from "react";
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
} from "remotion";

/* ─── Dark color palette (matching landing page) ─── */
const COLORS = {
    bg: "#09090B",
    card: "#16161A",
    cardHover: "#1C1C21",
    border: "rgba(255,255,255,0.08)",
    borderHover: "rgba(255,255,255,0.14)",
    text: "#FAFAFA",
    textSecondary: "#A1A1AA",
    textMuted: "#52525B",
    accent: "#E4E4E7",
    keyCap: "#1E1E23",
    keyCapActive: "#2A2A30",
    glow: "rgba(255,255,255,0.06)",
    glowActive: "rgba(255,255,255,0.15)",
    dotGreen: "#22C55E",
};

/* ─── Key layout for a stylised 3-row keyboard ─── */
const KEY_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
];

/* Sequential key press timings */
const PRESS_SEQUENCE = [
    { row: 2, col: 2, frame: 20 },
    { row: 1, col: 5, frame: 28 },
    { row: 0, col: 0, frame: 36 },
    { row: 1, col: 2, frame: 44 },
    { row: 0, col: 4, frame: 52 },
    { row: 2, col: 5, frame: 60 },
    { row: 0, col: 8, frame: 68 },
    { row: 1, col: 7, frame: 76 },
    { row: 0, col: 2, frame: 84 },
    { row: 2, col: 0, frame: 92 },
    { row: 1, col: 0, frame: 100 },
    { row: 0, col: 6, frame: 108 },
    { row: 2, col: 4, frame: 116 },
    { row: 1, col: 3, frame: 124 },
    { row: 0, col: 9, frame: 132 },
    { row: 2, col: 6, frame: 140 },
];

/* ─── Single Key ─── */
const Key = ({ label, isPressed, glowIntensity }) => {
    const pressY = isPressed ? 2 : 0;

    return (
        <div
            style={{
                width: 76,
                height: 68,
                borderRadius: 10,
                background: isPressed ? COLORS.keyCapActive : COLORS.keyCap,
                border: `1px solid ${isPressed ? COLORS.borderHover : COLORS.border}`,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: isPressed ? COLORS.text : COLORS.textSecondary,
                transform: `translateY(${pressY}px)`,
                boxShadow: isPressed
                    ? `0 0 ${24 * glowIntensity}px rgba(255,255,255,${0.08 * glowIntensity}), inset 0 1px 0 rgba(255,255,255,0.06)`
                    : `0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)`,
                userSelect: "none",
            }}
        >
            {label}
        </div>
    );
};

/* ─── Minimal floating dot particle ─── */
const Particle = ({ x, y, size, delay, frame }) => {
    const life = interpolate(frame - delay, [0, 120], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const opacity = interpolate(life, [0, 0.2, 0.7, 1], [0, 0.25, 0.25, 0], {
        extrapolateRight: "clamp",
    });
    const translateY = interpolate(life, [0, 1], [0, -50], {
        extrapolateRight: "clamp",
    });

    if (frame < delay) return null;

    return (
        <div
            style={{
                position: "absolute",
                left: x,
                top: y,
                width: size,
                height: size,
                borderRadius: "50%",
                background: COLORS.accent,
                opacity,
                transform: `translateY(${translateY}px)`,
                pointerEvents: "none",
            }}
        />
    );
};

/* ─── Main composition ─── */
export const KeyboardComposition = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    /* ── Phase 1: Keyboard entrance (frames 0-60) ── */
    const keyboardSlideUp = interpolate(frame, [0, 50], [80, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const keyboardOpacity = interpolate(frame, [0, 40], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    /* ── Phase 2: Text reveal (frames 55-160) ── */
    const HEADLINE = "Count your AI commits.";
    const letters = HEADLINE.split("");
    const textStartFrame = 55;
    const letterInterval = 3;

    const headlineBounce = spring({
        fps,
        frame: frame - (textStartFrame + letters.length * letterInterval),
        config: { damping: 18, stiffness: 100, mass: 0.6 },
    });
    const headlineScale = interpolate(headlineBounce, [0, 1], [0.98, 1], {
        extrapolateRight: "clamp",
    });

    /* ── Particles ── */
    const particles = [
        { x: "12%", y: "25%", size: 3, delay: 120 },
        { x: "85%", y: "20%", size: 4, delay: 150 },
        { x: "20%", y: "70%", size: 3, delay: 180 },
        { x: "75%", y: "75%", size: 5, delay: 200 },
        { x: "50%", y: "15%", size: 3, delay: 160 },
        { x: "92%", y: "55%", size: 4, delay: 190 },
        { x: "8%", y: "82%", size: 3, delay: 220 },
        { x: "65%", y: "88%", size: 4, delay: 240 },
    ];

    /* ── Subtle scan line for depth ── */
    const scanLineY = interpolate(frame, [0, 300], [-5, 105], {
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: COLORS.bg,
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
            }}
        >
            {/* Subtle radial gradient */}
            <div
                style={{
                    position: "absolute",
                    top: "20%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 900,
                    height: 500,
                    background: "radial-gradient(ellipse at center, rgba(255,255,255,0.03), transparent 70%)",
                    pointerEvents: "none",
                }}
            />

            {/* Horizontal scan line */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${scanLineY}%`,
                    height: 1,
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
                    pointerEvents: "none",
                }}
            />

            {/* Floating particles */}
            {particles.map((p, i) => (
                <Particle key={i} {...p} frame={frame} />
            ))}

            {/* ── Headline text ── */}
            <div
                style={{
                    position: "absolute",
                    top: 200,
                    width: "100%",
                    textAlign: "center",
                    transform: `scale(${headlineScale})`,
                }}
            >
                <h1
                    style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: 84,
                        fontWeight: 800,
                        color: COLORS.text,
                        letterSpacing: "-0.035em",
                        margin: 0,
                        lineHeight: 1.08,
                        display: "inline-flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        gap: 0,
                    }}
                >
                    {letters.map((letter, i) => {
                        const letterFrame = textStartFrame + i * letterInterval;
                        const letterOpacity = interpolate(
                            frame,
                            [letterFrame, letterFrame + 10],
                            [0, 1],
                            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                        );
                        const letterY = interpolate(
                            frame,
                            [letterFrame, letterFrame + 10],
                            [14, 0],
                            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                        );

                        return (
                            <span
                                key={i}
                                style={{
                                    opacity: letterOpacity,
                                    transform: `translateY(${letterY}px)`,
                                    display: "inline-block",
                                    whiteSpace: letter === " " ? "pre" : "normal",
                                    minWidth: letter === " " ? "0.3em" : undefined,
                                }}
                            >
                                {letter}
                            </span>
                        );
                    })}
                </h1>

                {/* Subtitle */}
                <p
                    style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: 26,
                        fontWeight: 400,
                        color: COLORS.textSecondary,
                        marginTop: 20,
                        letterSpacing: "-0.01em",
                        opacity: interpolate(frame, [130, 155], [0, 1], {
                            extrapolateLeft: "clamp",
                            extrapolateRight: "clamp",
                        }),
                        transform: `translateY(${interpolate(frame, [130, 155], [12, 0], {
                            extrapolateLeft: "clamp",
                            extrapolateRight: "clamp",
                        })}px)`,
                    }}
                >
                    Track your AI-assisted coding, beautifully.
                </p>
            </div>

            {/* ── Keyboard ── */}
            <div
                style={{
                    position: "absolute",
                    bottom: 100,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    opacity: keyboardOpacity,
                    transform: `translateY(${keyboardSlideUp}px)`,
                }}
            >
                <div
                    style={{
                        background: COLORS.card,
                        borderRadius: 20,
                        padding: "24px 32px",
                        border: `1px solid ${COLORS.border}`,
                        boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
                    }}
                >
                    {KEY_ROWS.map((row, rowIndex) => (
                        <div
                            key={rowIndex}
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                gap: 6,
                                marginBottom: rowIndex < KEY_ROWS.length - 1 ? 6 : 0,
                                paddingLeft: rowIndex === 1 ? 18 : rowIndex === 2 ? 44 : 0,
                            }}
                        >
                            {row.map((key, colIndex) => {
                                const press = PRESS_SEQUENCE.find(
                                    (p) => p.row === rowIndex && p.col === colIndex
                                );
                                let isPressed = false;
                                let glowIntensity = 0;

                                if (press) {
                                    const elapsed = frame - press.frame;
                                    isPressed = elapsed >= 0 && elapsed < 8;
                                    glowIntensity = isPressed
                                        ? interpolate(elapsed, [0, 4, 8], [1, 0.5, 0], {
                                            extrapolateLeft: "clamp",
                                            extrapolateRight: "clamp",
                                        })
                                        : 0;
                                }

                                return (
                                    <Key
                                        key={colIndex}
                                        label={key}
                                        isPressed={isPressed}
                                        glowIntensity={glowIntensity}
                                    />
                                );
                            })}
                        </div>
                    ))}

                    {/* Space bar */}
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
                        <div
                            style={{
                                width: 380,
                                height: 48,
                                borderRadius: 10,
                                background: COLORS.keyCap,
                                border: `1px solid ${COLORS.border}`,
                                boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
                            }}
                        />
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};
