// happy-dom implements the Web Animations API, so Base UI and motion wait on
// animations that never finish in a test and keep closed popups mounted. The
// test DOM has no such API, which sends both down their no-animation path.
if (typeof Element !== "undefined") {
  Reflect.deleteProperty(Element.prototype, "getAnimations");
  Reflect.deleteProperty(Element.prototype, "animate");
}
