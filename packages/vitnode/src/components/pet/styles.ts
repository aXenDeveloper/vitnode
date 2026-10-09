export const PET_CSS = `
.vn-pet-blink{transform-box:fill-box;transform-origin:center;animation:vn-pet-blink 4.2s ease-in-out infinite}
@keyframes vn-pet-blink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}
.vn-pet-ear{animation:vn-pet-ear 5s ease-in-out infinite}
@keyframes vn-pet-ear{0%,84%,100%{transform:rotate(0)}88%{transform:rotate(-12deg)}92%{transform:rotate(4deg)}}
.vn-pet-sway{animation:vn-pet-sway 1.6s ease-in-out infinite alternate}
@keyframes vn-pet-sway{from{transform:rotate(-10deg)}to{transform:rotate(12deg)}}
.vn-pet-wave{animation:vn-pet-wave .8s ease-in-out infinite alternate}
@keyframes vn-pet-wave{from{transform:rotate(-12deg)}to{transform:rotate(16deg)}}
.vn-pet-cheer{animation:vn-pet-cheer 1.2s ease-in-out infinite alternate}
@keyframes vn-pet-cheer{from{transform:rotate(-8deg)}to{transform:rotate(8deg)}}
.vn-pet-type{animation:vn-pet-type .36s ease-in-out infinite alternate}
@keyframes vn-pet-type{from{transform:translateY(0)}to{transform:translateY(-10px)}}
.vn-pet-heart{transform-box:fill-box;transform-origin:center;opacity:0;animation:vn-pet-heart 2.7s ease-out infinite}
@keyframes vn-pet-heart{0%{opacity:0;transform:translate(0,0) scale(.5)}20%{opacity:1;transform:translate(-2px,-8px) scale(1)}100%{opacity:0;transform:translate(-12px,-44px) scale(.9)}}
.vn-pet-rise-note{transform-box:fill-box;opacity:0;animation:vn-pet-rise-note 2.4s ease-out infinite}
@keyframes vn-pet-rise-note{0%{opacity:0;transform:translate(0,8px)}30%{opacity:1}100%{opacity:0;transform:translate(10px,-24px)}}
.vn-pet-breathe{transform-box:fill-box;transform-origin:50% 100%;animation:vn-pet-breathe 3.2s ease-in-out infinite}
@keyframes vn-pet-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.02,1.03)}}
.vn-pet-dot{transform-box:fill-box;animation:vn-pet-dot 1.2s ease-in-out infinite}
@keyframes vn-pet-dot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-6px);opacity:1}}
.vn-pet-scan{animation:vn-pet-scan 2.2s ease-in-out infinite alternate}
@keyframes vn-pet-scan{from{transform:translate(-10px,2px)}to{transform:translate(8px,-4px)}}
.vn-pet-confetti{transform-box:fill-box;transform-origin:center;opacity:0;animation:vn-pet-confetti 1.8s ease-in infinite}
@keyframes vn-pet-confetti{0%{opacity:0;transform:translateY(0) rotate(0)}10%{opacity:1}100%{opacity:0;transform:translateY(130px) rotate(540deg)}}
.vn-pet-pulse{transform-box:fill-box;transform-origin:center;animation:vn-pet-pulse 1.1s ease-in-out infinite}
@keyframes vn-pet-pulse{0%,30%,100%{transform:scale(1)}15%{transform:scale(1.12)}45%{transform:scale(1.08)}}
.vn-pet-snore{transform-box:fill-box;transform-origin:0% 50%;animation:vn-pet-snore 3.2s ease-in-out infinite}
@keyframes vn-pet-snore{0%,100%{transform:scale(.3)}50%{transform:scale(1)}}
.vn-pet-drip{transform-box:fill-box;animation:vn-pet-drip 1.8s ease-in infinite}
@keyframes vn-pet-drip{0%{opacity:0;transform:translateY(-4px)}20%{opacity:1}100%{opacity:0;transform:translateY(30px)}}
.vn-pet-steam{transform-box:fill-box;opacity:0;animation:vn-pet-steam 2.1s ease-out infinite}
@keyframes vn-pet-steam{0%{opacity:0;transform:translateY(6px)}40%{opacity:.7}100%{opacity:0;transform:translateY(-14px)}}
.vn-pet-groove{transform-box:fill-box;transform-origin:50% 100%;animation:vn-pet-groove .5s ease-in-out infinite alternate}
@keyframes vn-pet-groove{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
.vn-pet-signal{animation:vn-pet-signal 1.5s ease-in-out infinite}
@keyframes vn-pet-signal{0%,100%{opacity:.15}40%{opacity:1}}
.vn-pet-spin{transform-box:fill-box;transform-origin:center;animation:vn-pet-spin 1.4s linear infinite}
@keyframes vn-pet-spin{to{transform:rotate(360deg)}}
.vn-pet-orbit{animation:vn-pet-orbit 2.4s linear infinite}
@keyframes vn-pet-orbit{0%,100%{transform:translate(112px,0) scale(1)}12.5%{transform:translate(79px,18px) scale(1.15)}25%{transform:translate(0,26px) scale(1.25)}37.5%{transform:translate(-79px,18px) scale(1.15)}50%{transform:translate(-112px,0) scale(1)}62.5%{transform:translate(-79px,-18px) scale(.85)}75%{transform:translate(0,-26px) scale(.75)}87.5%{transform:translate(79px,-18px) scale(.85)}}
.vn-pet-woozy{transform-box:fill-box;transform-origin:50% 100%;animation:vn-pet-woozy 1.6s ease-in-out infinite alternate}
@keyframes vn-pet-woozy{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
.vn-pet-hammer{animation:vn-pet-hammer .9s ease-in-out infinite}
@keyframes vn-pet-hammer{0%,100%{transform:rotate(-10deg)}35%{transform:rotate(40deg)}}
@media (prefers-reduced-motion:reduce){.vitnode-pet *{animation:none}}
`;
