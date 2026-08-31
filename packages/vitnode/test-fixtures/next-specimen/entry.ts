/**
 * A deliberate Next.js import graph, so the scanner has something to find.
 *
 * Every "reaches nothing from next/*" assertion in this package is a *negative*
 * one, and a scanner that silently matches nothing satisfies all of them. The
 * controls used to point at real Next.js modules; Stage 17 deleted those, which
 * would have left the whole suite asserting the absence of a thing it could no
 * longer prove it was able to detect.
 *
 * So the specimen is a fixture instead. It lives outside `tsconfig.json`'s
 * `include`, so `next` never has to be installed for tsc to accept it, and
 * outside `src`, so nothing can import it by accident. It exists to be scanned
 * and for no other reason - which is also why it can never rot: production code
 * moving on cannot take its specimen with it.
 *
 * It is one hop deep on purpose. A one-file fixture would still pass a scanner
 * that read only the entry and never followed an edge, and "the offending import
 * is three files away from the one being written" is the whole reason these
 * scans exist.
 */
export { viaHop } from "./hop";
