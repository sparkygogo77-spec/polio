/* The shelf module's runs: a part's theme and a repository's features. They need the bundler's imports, so they are not in the pure ./index.ts. See README.md. */
export { FAMILY, FILL_TILE, STAND_IN, applyBand, applyCaptured, applyEdge, applyFont, applyLayout, applyPad, applyText, boxPicture, boxStyle, boxStyles, cardStyle, centresDown, fillLayers, ghostStyle, hasBox, inkOf, items, liftTheme, overrideTheme, radiusFor, resolvePalette, saidRole, standIn, themeFrom, tint, titled, withAlpha } from "./parts/theme";
export type { FillLayer, NodeArt, NodeBox, NodeColour, NodeEdge, NodeFont, NodeLayout, NodePad, NodeSaid, NodeText, Theme } from "./parts/theme";
export { filmPic } from "./parts/film";
export { checkRepoFeatures, readRepoFeatures } from "./library/repoFeatures";
export type { RepoFeatures } from "./library/repoFeatures";
