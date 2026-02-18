import React from "react";
import { Composition } from "remotion";
import { KeyboardComposition } from "./KeyboardComposition";

export const RemotionRoot = () => {
    return (
        <Composition
            id="KeyboardComposition"
            component={KeyboardComposition}
            durationInFrames={300}
            fps={30}
            width={1920}
            height={1080}
        />
    );
};
