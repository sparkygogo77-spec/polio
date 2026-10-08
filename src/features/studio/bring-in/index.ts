/* The bring-in module's pure door: reading a site (in-page scripts, page parts), capturing it, and bringing a repository or a zip in. No React, no store, every import ends in .ts, so node tests load it.
 * The From a site screen and re-capturing (store-bound) are behind ./ui.ts. Named re-exports (not export *) so an import cycle still sees every name. See README.md. */
export { CANDIDATES, FACES, MEASURE, PARTS } from "./siteRead.ts";
export type { Candidate, PagePart, PageRead, PartControl, PartRun, PartState, PartStyle } from "./siteRead.ts";
export { CHIP_MEANS, KIND_WORDS, clippedCorners, kindsSaid, lookFromCapture, pageLink, pagesToDoc, reportChips, reportSays, rideAnimations } from "./pageParts.ts";
export type { FileRead, LandedDoc, LandedPage, PageReport, ReportChip } from "./pageParts.ts";
export { MAX_SOURCE_BYTES, MAX_SOURCE_FILES, SOURCE_WANTED, findPage, jsxToHtml, neededBy, readSource, themeOf, twToStyle } from "./sourceSite.ts";
export type { SourceFile, SourceNotes, SourcePage } from "./sourceSite.ts";
export { DEFAULT_CAPTURER, WORKFLOW, captureBranch, captureName, capturePlace, captureWant, handsBack, isMainBranch, nameFrom, oneAddress, readRun, startCapture, watchCapture, withoutJoinedAddress, workflowPermissionSays } from "./captureSite.ts";
export type { CaptureRepo, Ended, Pipes, Progress, RunState, Started } from "./captureSite.ts";
export { MADE_HERE, MAX_REPO_BYTES, MAX_REPO_FILES, MAX_SEND_BYTES, REPO_REFUSAL_SAYS, categoryFor, crc32, docPathIn, heaviestFolders, inFolders, madeHere, noPageSays, packedZipOf, pageAddress, pageIn, pathIn, readRepo, referenced, repoName, sameSource, siteFolders, thinSays, wanted, withPath, zipOf } from "./repoImport.ts";
export type { Repo, RepoRefusal } from "./repoImport.ts";
export { MAX_BLOCKS, MAX_FILES, MAX_FILE_BYTES, MAX_UNPACKED_BYTES, MAX_ZIP_BYTES, MIN_BAND, SURE, ZIP_BUDGET_MS, ZIP_REFUSAL_SAYS, checkZip, contentType, fileFor, fine, fitToSurface, hadScripts, insideZip, mergeReadings, offered, pageBlocks, pageEntry, readable, saidOf, sansScripts, scaledType, selectorsOf } from "./zipImport.ts";
export type { Block, Fitted, Landed, ZipEntry, ZipNo, ZipOk, ZipRefusal } from "./zipImport.ts";
export { facetSays, facets, fingerprint, isTaken, keepOwnerEdits, keptSays, keptShort, keysOf, print } from "./reimport.ts";
export type { Kept, MergeDoc, MergeNode, Taken } from "./reimport.ts";
