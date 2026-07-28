const http = require('http');
const url = require('url');
const PORT = process.env.PORT || 3000;

const D = {
  c: {
    n: "Baiilla Maach Official",
    p: "https://i.imgur.com/yBIY66i.jpeg",
    b: "",
    t: "",
    v: ""
  },
  r: [
    {
      l: "TikTok",
      i: "",
      u: "@baiillamaach_official",
      w: "https://tiktok.com/@baiillamaach_official",
      f: "",
      g: ""
    }
  ],
  f: [
    {
      l: "TikTok",
      i: "",
      u: "@baiilla_mach",
      w: "https://tiktok.com/@baiilla_mach",
      s: "https://i.imgur.com/JM5hQmH.jpeg",
      d: "critical",
      b: "",
      r: ""
    },
    {
      l: "TikTok",
      i: "",
      u: "@hammad_fams0",
      w: "https://tiktok.com/@hammad_fams0",
      s: "https://i.imgur.com/9mFUyji.jpeg",
      d: "high",
      b: "",
      r: ""
    }
  ]
};

const H = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="description" content="${D.c.n}">
<meta property="og:title" content="${D.c.n}">
<meta property="og:image" content="${D.c.p}">
<title>${D.c.n}</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{
--bg:#000000;
--bg2:#030303;
--bg3:#0a0a0a;
--bg4:#0f0f0f;
--bg5:#141414;
--bg6:#1a1a1a;
--bg7:#1f1f1f;
--red:#ff2450;
--red2:#e60040;
--red3:#ff4466;
--red4:rgba(255,36,80,.15);
--red5:rgba(255,36,80,.3);
--red6:rgba(255,36,80,.08);
--green:#00e676;
--green2:#00c853;
--green3:#69f0ae;
--green4:rgba(0,230,118,.15);
--green5:rgba(0,230,118,.3);
--yellow:#ffd600;
--yellow2:#ffab00;
--orange:#ff6d00;
--orange2:#ff9100;
--white:#ffffff;
--w2:#f5f5f5;
--w3:#e0e0e0;
--w4:#bdbdbd;
--w5:#9e9e9e;
--w6:#757575;
--w7:#616161;
--w8:#424242;
--g1:linear-gradient(135deg,#ff2450,#ff6d00);
--g2:linear-gradient(135deg,#00e676,#00b0ff);
--g3:linear-gradient(135deg,#ffd600,#ff6d00);
--g4:linear-gradient(180deg,rgba(255,36,80,.03),transparent);
--g5:linear-gradient(180deg,rgba(0,230,118,.03),transparent);
--g6:linear-gradient(135deg,rgba(255,36,80,.1),rgba(255,109,0,.1));
--g7:linear-gradient(135deg,rgba(0,230,118,.1),rgba(0,176,255,.1));
--g8:linear-gradient(135deg,rgba(0,0,0,.95),rgba(10,0,0,.98));
--g9:linear-gradient(135deg,rgba(0,0,0,.95),rgba(0,10,0,.98));
--g10:linear-gradient(180deg,rgba(10,0,0,.98),var(--bg));
--g11:linear-gradient(180deg,rgba(0,10,0,.98),var(--bg));
--s1:0 0 0 1px rgba(255,255,255,.03);
--s2:0 0 0 1px rgba(255,255,255,.06);
--s3:0 0 0 1px rgba(255,255,255,.1);
--s4:0 2px 8px rgba(0,0,0,.4);
--s5:0 4px 20px rgba(0,0,0,.6);
--s6:0 8px 40px rgba(0,0,0,.8);
--s7:0 0 30px var(--red4);
--s8:0 0 30px var(--green4);
--s9:0 0 60px var(--red5);
--s10:0 0 60px var(--green5);
--s11:0 0 100px var(--red4);
--s12:0 10px 40px rgba(0,0,0,.5);
--r1:4px;
--r2:8px;
--r3:12px;
--r4:16px;
--r5:20px;
--r6:24px;
--r7:30px;
--r8:50px;
--r9:100px;
--t1:all .15s ease;
--t2:all .2s ease;
--t3:all .25s cubic-bezier(.4,0,.2,1);
--t4:all .3s cubic-bezier(.4,0,.2,1);
--t5:all .4s cubic-bezier(.4,0,.2,1);
--t6:all .5s cubic-bezier(.4,0,.2,1);
--f1:'Plus Jakarta Sans',sans-serif;
--f2:'Hind Siliguri',sans-serif
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{font-family:var(--f1);background:var(--bg);color:var(--white);min-height:100vh;overflow-x:hidden;line-height:1.6}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--g1);border-radius:var(--r9)}
::selection{background:var(--red);color:var(--white)}

@keyframes float1{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(10px,-15px) scale(1.05)}50%{transform:translate(-5px,-25px) scale(.95)}75%{transform:translate(-10px,-10px) scale(1.02)}}
@keyframes float2{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(-15px,10px) scale(1.03)}50%{transform:translate(5px,20px) scale(.97)}75%{transform:translate(10px,5px) scale(1.04)}}
@keyframes float3{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(15px,15px) scale(.96)}50%{transform:translate(-10px,5px) scale(1.06)}75%{transform:translate(-5px,-15px) scale(.98)}}
@keyframes pulse1{0%,100%{box-shadow:0 0 0 0 var(--red5);transform:scale(1)}50%{box-shadow:0 0 0 20px rgba(255,36,80,0);transform:scale(1.02)}}
@keyframes pulse2{0%,100%{box-shadow:0 0 0 0 var(--green5);transform:scale(1)}50%{box-shadow:0 0 0 20px rgba(0,230,118,0);transform:scale(1.02)}}
@keyframes shake{0%,100%{transform:rotate(0deg)}10%{transform:rotate(-8deg)}20%{transform:rotate(8deg)}30%{transform:rotate(-6deg)}40%{transform:rotate(6deg)}50%{transform:rotate(-4deg)}60%{transform:rotate(4deg)}70%{transform:rotate(-2deg)}80%{transform:rotate(2deg)}90%{transform:rotate(0deg)}}
@keyframes glitch1{0%,100%{transform:translate(0)}20%{transform:translate(-2px,2px)}40%{transform:translate(2px,-2px)}60%{transform:translate(-1px,-1px)}80%{transform:translate(1px,1px)}}
@keyframes glitch2{0%,100%{transform:translate(0)}20%{transform:translate(2px,-2px)}40%{transform:translate(-2px,2px)}60%{transform:translate(1px,1px)}80%{transform:translate(-1px,-1px)}}
@keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
@keyframes flicker{0%,100%{opacity:1}5%{opacity:.9}10%{opacity:1}15%{opacity:.85}20%{opacity:1}50%{opacity:.95}80%{opacity:1}90%{opacity:.9}}
@keyframes gradient1{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes gradient2{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes rotate1{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes rotate2{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
@keyframes scaleIn{0%{transform:scale(.8);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes slideUp{0%{transform:translateY(30px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes slideDown{0%{transform:translateY(-30px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes slideLeft{0%{transform:translateX(30px);opacity:0}100%{transform:translateX(0);opacity:1}}
@keyframes slideRight{0%{transform:translateX(-30px);opacity:0}100%{transform:translateX(0);opacity:1}}
@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}
@keyframes fadeInUp{0%{transform:translateY(40px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes fadeInDown{0%{transform:translateY(-40px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes fadeInLeft{0%{transform:translateX(40px);opacity:0}100%{transform:translateX(0);opacity:1}}
@keyframes fadeInRight{0%{transform:translateX(-40px);opacity:0}100%{transform:translateX(0);opacity:1}}
@keyframes zoomIn{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes zoomOut{0%{transform:scale(1.5);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes bounce1{0%,100%{transform:translateY(0)}40%{transform:translateY(-20px)}60%{transform:translateY(-10px)}}
@keyframes bounce2{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}
@keyframes ripple{0%{transform:scale(0);opacity:1}100%{transform:scale(4);opacity:0}}
@keyframes typing{from{width:0}}
@keyframes blink1{0%,100%{border-color:transparent}50%{border-color:var(--red)}}
@keyframes blink2{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes dash{0%{stroke-dashoffset:1000}100%{stroke-dashoffset:0}}
@keyframes neon1{0%,100%{text-shadow:0 0 7px #fff,0 0 10px #fff,0 0 21px #fff,0 0 42px var(--red),0 0 82px var(--red),0 0 92px var(--red),0 0 102px var(--red),0 0 151px var(--red)}50%{text-shadow:0 0 4px #fff,0 0 7px #fff,0 0 13px #fff,0 0 26px var(--red),0 0 51px var(--red),0 0 57px var(--red),0 0 64px var(--red),0 0 94px var(--red)}}
@keyframes neon2{0%,100%{text-shadow:0 0 7px #fff,0 0 10px #fff,0 0 21px #fff,0 0 42px var(--green),0 0 82px var(--green),0 0 92px var(--green),0 0 102px var(--green),0 0 151px var(--green)}50%{text-shadow:0 0 4px #fff,0 0 7px #fff,0 0 13px #fff,0 0 26px var(--green),0 0 51px var(--green),0 0 57px var(--green),0 0 64px var(--green),0 0 94px var(--green)}}
@keyframes borderGlow1{0%,100%{border-color:var(--red);box-shadow:0 0 10px var(--red4),inset 0 0 10px var(--red6)}50%{border-color:var(--red3);box-shadow:0 0 20px var(--red5),inset 0 0 20px var(--red4)}}
@keyframes borderGlow2{0%,100%{border-color:var(--green);box-shadow:0 0 10px var(--green4),inset 0 0 10px rgba(0,230,118,.04)}50%{border-color:var(--green3);box-shadow:0 0 20px var(--green5),inset 0 0 20px var(--green4)}}
@keyframes cardFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes particle1{0%{transform:translate(0,0) scale(1);opacity:0}20%{opacity:1}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}
@keyframes particle2{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) rotate(720deg) scale(0);opacity:0}}

.glow{position:fixed;border-radius:50%;filter:blur(180px);pointer-events:none;z-index:0;opacity:.06}
.glow-1{width:800px;height:800px;background:var(--red);top:-300px;left:-200px;animation:float1 20s ease-in-out infinite}
.glow-2{width:700px;height:700px;background:var(--orange);bottom:-300px;right:-200px;animation:float2 25s ease-in-out infinite}
.glow-3{width:600px;height:600px;background:var(--red);top:50%;left:50%;transform:translate(-50%,-50%);animation:float3 18s ease-in-out infinite}
.glow-4{width:500px;height:500px;background:var(--green);top:20%;right:-150px;animation:float1 22s ease-in-out infinite;opacity:.03}
.glow-5{width:400px;height:400px;background:var(--yellow);bottom:10%;left:-100px;animation:float2 19s ease-in-out infinite;opacity:.02}

.scanlines{position:fixed;top:0;left:0;width:100%;height:100%;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.03) 2px,rgba(0,0,0,.03) 4px);pointer-events:none;z-index:9999;opacity:.3}
.scanline-bar{position:fixed;top:0;left:0;width:100%;height:3px;background:rgba(255,255,255,.015);pointer-events:none;z-index:9998;animation:scanline 8s linear infinite}
.noise{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9997;opacity:.02;background:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:200px}

.particles{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1}
.particle{position:absolute;width:2px;height:2px;background:var(--red);border-radius:50%;animation:particle1 6s linear infinite;opacity:0}
.particle:nth-child(odd){background:var(--orange);animation-duration:8s}
.particle:nth-child(3n){background:var(--green);animation-duration:7s}
.particle:nth-child(5n){width:1px;height:1px;animation-duration:10s}
.particle:nth-child(7n){background:var(--yellow);animation-duration:9s}

nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(0,0,0,.75);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border-bottom:1px solid rgba(255,255,255,.04);padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;animation:slideDown .6s ease}
.nav-l{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--white)}
.nav-l img{width:36px;height:36px;border-radius:50%;border:2px solid var(--red);object-fit:cover;animation:pulse1 3s infinite}
.nav-l span{font-weight:800;font-size:.95em;font-family:var(--f2);letter-spacing:.3px}
.nav-b{background:var(--g1);color:var(--white);padding:6px 14px;border-radius:var(--r8);font-size:.7em;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;animation:pulse1 2s infinite}

.hero{position:relative;z-index:2;text-align:center;padding:140px 20px 60px;max-width:800px;margin:0 auto;animation:fadeInUp .8s ease}
.hero-frame{position:relative;display:inline-block;margin-bottom:24px}
.hero-frame::before{content:'';position:absolute;inset:-8px;border-radius:50%;background:var(--g1);opacity:.3;filter:blur(20px);animation:rotate1 10s linear infinite}
.hero-frame::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:3px solid transparent;border-top-color:var(--red);border-right-color:var(--orange);animation:rotate2 6s linear infinite}
.hero-img{width:160px;height:160px;border-radius:50%;object-fit:cover;position:relative;z-index:1;border:4px solid rgba(255,255,255,.1);box-shadow:var(--s9);animation:float1 4s ease-in-out infinite}
.hero-img-placeholder{width:160px;height:160px;border-radius:50%;background:var(--g6);display:flex;align-items:center;justify-content:center;font-size:60px;position:relative;z-index:1;border:4px solid rgba(255,255,255,.1);box-shadow:var(--s9);animation:float1 4s ease-in-out infinite;margin:0 auto}
.hero h1{font-size:clamp(1.8em,5vw,3em);font-weight:900;margin:16px 0 8px;background:var(--g1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;background-size:200% 200%;animation:gradient1 4s ease infinite;line-height:1.2;font-family:var(--f2)}
.hero .subtitle{color:var(--w4);font-size:1.05em;margin-bottom:20px;font-family:var(--f2)}
.hero-badges{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px}
.hbadge{padding:8px 18px;border-radius:var(--r8);font-size:.78em;font-weight:700;letter-spacing:.5px;transition:var(--t3);font-family:var(--f2)}
.hbadge-official{background:var(--g1);color:var(--white);box-shadow:var(--s7);animation:pulse1 2.5s infinite}
.hbadge-official:hover{transform:translateY(-3px);box-shadow:var(--s9)}
.hbadge-fun{background:var(--orange);color:var(--white);box-shadow:0 0 20px rgba(255,109,0,.3)}
.hbadge-fun:hover{transform:translateY(-3px)}

.alert-hero{position:relative;z-index:2;max-width:750px;margin:0 auto 40px;padding:0 20px;animation:fadeInUp 1s ease}
.alert-hero-inner{background:var(--g8);border:2px solid rgba(255,36,80,.3);border-radius:var(--r6);padding:32px 28px;text-align:center;position:relative;overflow:hidden}
.alert-hero-inner::before{content:'';position:absolute;inset:0;background:var(--g6);opacity:.1}
.alert-hero-inner .alert-icon{font-size:3.5em;display:block;margin-bottom:12px;animation:shake 3s infinite;position:relative;z-index:1}
.alert-hero-inner h3{color:var(--red);font-size:1.3em;margin-bottom:8px;position:relative;z-index:1;font-family:var(--f2)}
.alert-hero-inner p{color:var(--w3);font-size:.95em;position:relative;z-index:1;font-family:var(--f2);line-height:1.8}
.alert-hero-inner .alert-line{position:absolute;top:0;left:0;width:100%;height:2px;background:var(--g1);animation:scanline 4s linear infinite}

.container{position:relative;z-index:2;max-width:800px;margin:0 auto;padding:0 24px 60px}

.section-guide{background:var(--bg3);border:1px solid var(--bg6);border-radius:var(--r6);padding:32px;margin:30px 0;animation:fadeInUp 1.1s ease;position:relative;overflow:hidden}
.section-guide::after{content:'';position:absolute;top:-50%;right:-50%;width:300px;height:300px;background:radial-gradient(circle,rgba(255,214,0,.03),transparent 70%);pointer-events:none}
.section-guide h3{color:var(--yellow);font-size:1.2em;margin-bottom:20px;display:flex;align-items:center;gap:8px;font-family:var(--f2)}
.step{padding:18px 22px;margin:10px 0;border-radius:var(--r4);background:var(--bg4);border-left:4px solid var(--green);transition:var(--t3);position:relative;overflow:hidden}
.step:hover{transform:translateX(6px);background:var(--bg5)}
.step::after{content:'';position:absolute;top:0;right:0;width:100px;height:100%;background:linear-gradient(90deg,transparent,rgba(0,230,118,.02));pointer-events:none}
.step.fake-step{border-left-color:var(--red)}
.step.fake-step::after{background:linear-gradient(90deg,transparent,rgba(255,36,80,.02))}
.step.fake-step.critical{border-left-color:var(--red);border-left-width:5px;background:var(--bg3);box-shadow:inset 0 0 30px rgba(255,36,80,.02)}
.step h4{font-size:1em;margin-bottom:4px;display:flex;align-items:center;gap:10px;font-family:var(--f2)}
.step .step-num{width:28px;height:28px;border-radius:50%;background:var(--bg6);display:flex;align-items:center;justify-content:center;font-size:.8em;font-weight:700;flex-shrink:0}
.step .step-badge{font-size:.7em;padding:3px 10px;border-radius:var(--r8);font-weight:600;letter-spacing:.5px}
.step .step-badge.danger{background:var(--red);color:var(--white);animation:blink2 1.5s infinite}
.step .step-badge.warning{background:var(--orange);color:var(--white)}
.step .step-un{font-weight:700;color:var(--red);font-size:.95em}
.step .step-un.green{color:var(--green)}
.step p{color:var(--w5);font-size:.88em;margin-top:6px;font-family:var(--f2);line-height:1.7}
.step .spell-note{background:rgba(255,214,0,.05);border:1px solid rgba(255,214,0,.15);color:var(--yellow);padding:6px 12px;border-radius:var(--r2);display:inline-block;font-size:.82em;margin-top:8px;font-family:var(--f2)}

.sec{margin:40px 0}
.sec-title{font-size:1.4em;font-weight:800;margin-bottom:20px;padding-bottom:12px;display:flex;align-items:center;gap:10px;font-family:var(--f2);position:relative}
.sec-title.green-title{border-bottom:3px solid var(--green)}
.sec-title.red-title{border-bottom:3px solid var(--red)}
.sec-title .sec-icon{font-size:1.2em}
.sec-title .sec-line{position:absolute;bottom:-3px;left:0;height:3px;border-radius:var(--r9)}
.sec-title .sec-line.green-line{background:var(--g2);width:60px;animation:gradient2 3s ease infinite;background-size:200% 200%}
.sec-title .sec-line.red-line{background:var(--g1);width:60px;animation:gradient1 3s ease infinite;background-size:200% 200%}

.card{position:relative;border-radius:var(--r5);padding:24px;margin:16px 0;transition:var(--t4);overflow:hidden}
.card::before{content:'';position:absolute;inset:0;opacity:.5;transition:var(--t4)}
.card:hover{transform:translateY(-5px)}
.card:hover::before{opacity:1}
.card-verified{background:var(--g9);border:1px solid rgba(0,230,118,.2)}
.card-verified::before{background:var(--g7)}
.card-verified:hover{box-shadow:var(--s8),0 20px 60px rgba(0,0,0,.6);border-color:rgba(0,230,118,.4)}
.card-fake{background:var(--g8);border:1px solid rgba(255,36,80,.2)}
.card-fake::before{background:var(--g6)}
.card-fake:hover{box-shadow:var(--s7),0 20px 60px rgba(0,0,0,.6);border-color:rgba(255,36,80,.4)}
.card-fake.critical{border-width:2px;border-color:rgba(255,36,80,.5);animation:borderGlow1 3s infinite}
.card-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;position:relative;z-index:1}
.pbadge{padding:6px 14px;border-radius:var(--r8);font-weight:700;font-size:.78em;letter-spacing:.5px;font-family:var(--f2)}
.pbadge-green{background:rgba(0,230,118,.2);color:var(--green);border:1px solid rgba(0,230,118,.3)}
.pbadge-red{background:rgba(255,36,80,.2);color:var(--red);border:1px solid rgba(255,36,80,.3)}
.card .username{font-size:1.15em;font-weight:700;letter-spacing:.3px;font-family:var(--f2);position:relative;z-index:1}
.card .tag{display:inline-block;padding:5px 12px;border-radius:var(--r8);font-size:.72em;font-weight:600;margin-bottom:10px;position:relative;z-index:1;font-family:var(--f2)}
.card .tag-official{background:rgba(0,230,118,.15);color:var(--green3)}
.card .tag-fake{background:rgba(255,36,80,.15);color:var(--red3)}

.ss-box{position:relative;z-index:1;background:var(--bg);border-radius:var(--r3);padding:16px;margin:14px 0;text-align:center;border:1px solid var(--bg6);overflow:hidden}
.ss-box img{max-width:100%;max-height:320px;border-radius:var(--r2);cursor:pointer;transition:var(--t5);border:1px solid var(--bg7);filter:brightness(.9)}
.ss-box img:hover{filter:brightness(1.1);box-shadow:var(--s5)}
.ss-box img.zoomed{transform:scale(2.2);z-index:100;position:relative;filter:brightness(1.2);box-shadow:var(--s6)}
.ss-hint{display:block;color:var(--w7);font-size:.7em;margin-top:8px;font-family:var(--f2)}

.card .reason{color:var(--w3);font-size:.85em;margin:10px 0;line-height:1.7;position:relative;z-index:1;font-family:var(--f2);padding:10px 14px;background:rgba(255,255,255,.02);border-radius:var(--r2)}
.card .reason strong{color:var(--red)}

.btn-group{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;position:relative;z-index:1}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;border-radius:var(--r8);font-weight:700;font-size:.88em;text-decoration:none;border:none;cursor:pointer;font-family:var(--f1);transition:var(--t3);letter-spacing:.3px;position:relative;overflow:hidden}
.btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,.1);opacity:0;transition:var(--t2)}
.btn:hover::after{opacity:1}
.btn:active{transform:scale(.96)}
.btn-follow{background:var(--green);color:var(--bg);box-shadow:0 4px 20px rgba(0,230,118,.3)}
.btn-follow:hover{box-shadow:0 6px 30px rgba(0,230,118,.5);transform:translateY(-2px)}
.btn-report{background:var(--red);color:var(--white);box-shadow:0 4px 20px rgba(255,36,80,.3)}
.btn-report:hover{box-shadow:0 6px 30px rgba(255,36,80,.5);transform:translateY(-2px)}
.btn-copy{background:var(--bg5);color:var(--white);border:1px solid var(--bg7)}
.btn-copy:hover{background:var(--bg6);border-color:var(--w8)}
.btn-copy.copied{background:var(--green)!important;color:var(--bg)!important;border-color:var(--green)!important}
.btn-icon{font-size:1.1em;flex-shrink:0}

.action-box{background:var(--bg3);border:2px solid rgba(255,214,0,.3);border-radius:var(--r6);padding:32px;margin:40px 0;animation:fadeInUp 1.2s ease;position:relative;overflow:hidden}
.action-box::before{content:'';position:absolute;top:0;right:0;width:200px;height:200px;background:radial-gradient(circle,rgba(255,214,0,.04),transparent 70%);pointer-events:none}
.action-box h3{color:var(--yellow);text-align:center;font-size:1.2em;margin-bottom:20px;font-family:var(--f2);position:relative;z-index:1}
.action-box ol{list-style:none;counter-reset:action;position:relative;z-index:1}
.action-box ol li{counter-increment:action;padding:14px 14px 14px 50px;position:relative;color:var(--w3);font-size:.9em;line-height:1.7;margin:6px 0;font-family:var(--f2);border-radius:var(--r2);transition:var(--t2)}
.action-box ol li:hover{background:rgba(255,255,255,.02)}
.action-box ol li::before{content:counter(action);position:absolute;left:8px;top:12px;width:30px;height:30px;background:rgba(255,214,0,.15);color:var(--yellow);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85em;border:2px solid rgba(255,214,0,.3)}
.action-box .tip{background:rgba(255,214,0,.04);border:1px solid rgba(255,214,0,.2);border-radius:var(--r3);padding:16px;margin-top:18px;text-align:center;color:var(--yellow);font-size:.88em;font-family:var(--f2);position:relative;z-index:1}

footer{position:relative;z-index:2;text-align:center;padding:50px 20px 40px;border-top:1px solid var(--bg5);margin-top:20px;animation:fadeIn 1.5s ease}
footer .footer-text{color:var(--w6);font-size:.82em;font-family:var(--f2)}
footer .footer-sub{color:var(--w8);font-size:.7em;margin-top:6px;font-family:var(--f2)}
footer .footer-dot{display:inline-block;width:6px;height:6px;background:var(--red);border-radius:50%;margin:12px auto;animation:pulse1 2s infinite}
.copyright{color:var(--w8);font-size:.7em;margin-top:8px;font-family:var(--f2)}

.ripple-effect{position:absolute;border-radius:50%;background:rgba(255,255,255,.2);transform:scale(0);animation:ripple .6s ease-out;pointer-events:none}

.scroll-top{position:fixed;bottom:30px;right:30px;z-index:999;width:45px;height:45px;border-radius:50%;background:var(--g1);border:none;cursor:pointer;box-shadow:var(--s7);display:flex;align-items:center;justify-content:center;font-size:1.2em;color:var(--white);transition:var(--t3);opacity:0;visibility:hidden;transform:translateY(20px)}
.scroll-top.visible{opacity:1;visibility:visible;transform:translateY(0)}
.scroll-top:hover{transform:translateY(-5px);box-shadow:var(--s9)}

@keyframes toastIn{0%{transform:translateY(20px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes toastOut{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-20px);opacity:0}}
.toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--bg3);border:1px solid var(--green);border-radius:var(--r8);padding:12px 24px;color:var(--green);font-weight:600;font-size:.9em;box-shadow:var(--s8);animation:toastIn .3s ease;font-family:var(--f2);display:flex;align-items:center;gap:8px}
.toast.hide{animation:toastOut .3s ease forwards}

@media(max-width:768px){
.hero{padding:120px 16px 40px}
.hero h1{font-size:1.6em}
.hero-img,.hero-img-placeholder{width:120px;height:120px}
.container{padding:0 16px 40px}
.card{padding:18px}
.card-row{justify-content:center;text-align:center}
.btn-group{flex-direction:column}
.btn{width:100%;justify-content:center}
.section-guide,.action-box{padding:22px}
.step{padding:14px 16px}
.alert-hero-inner{padding:24px 18px}
nav{padding:0 16px}
.scroll-top{bottom:20px;right:20px;width:40px;height:40px}
}

@media(max-width:400px){
.hero h1{font-size:1.3em}
.hero-badges{flex-direction:column;align-items:center}
.card .username{font-size:1em}
.sec-title{font-size:1.1em}
}
</style>
</head>
<body>

<div class="glow glow-1"></div>
<div class="glow glow-2"></div>
<div class="glow glow-3"></div>
<div class="glow glow-4"></div>
<div class="glow glow-5"></div>
<div class="scanlines"></div>
<div class="scanline-bar"></div>
<div class="noise"></div>

<div class="particles" id="particles"></div>

<nav>
<a href="/" class="nav-l">
<img src="${D.c.p}" alt="" onerror="this.style.display='none'">
<span>${D.c.n}</span>
</a>
<span class="nav-b">OFFICIAL</span>
</nav>

<section class="hero">
<div class="hero-frame">
<img src="${D.c.p}" alt="" class="hero-img" onerror="this.parentElement.innerHTML='<div class=hero-img-placeholder>🎭</div>'">
</div>
<h1>${D.c.n}</h1>
<p class="subtitle">${D.c.b}</p>
<div class="hero-badges">
<span class="hbadge hbadge-official">✅ OFFICIAL PAGE</span>
<span class="hbadge hbadge-fun">🎭 ENTERTAINMENT</span>
</div>
</section>

<div class="alert-hero">
<div class="alert-hero-inner">
<div class="alert-line"></div>
<span class="alert-icon">⚠️</span>
<h3>${D.c.n} নামে অনেক ভুয়া একাউন্ট আছে</h3>
<p>নিচে আসল ও ভুয়া একাউন্টের তালিকা দেওয়া হলো।<br>দয়া করে ভালোভাবে দেখুন এবং সাবধান থাকুন।</p>
</div>
</div>

<div class="container">

<div class="section-guide">
<h3>📖 আসল একাউন্ট চেনার উপায়</h3>

<div class="step">
<h4><span class="step-num">১</span> আসল একাউন্ট <span class="step-badge" style="background:var(--green);color:var(--bg)">OFFICIAL</span></h4>
<p><strong>অফিসিয়াল ইউজারনেম:</strong> <span class="step-un green">@baiillamaach_official</span></p>
<p>এটিই আমাদের <strong>একমাত্র অফিসিয়াল প্রোফাইল।</strong> আমাদের সব আপডেট ও কন্টেন্ট শুধুমাত্র এই একাউন্ট থেকেই পোস্ট করা হয়। এর বাইরে আমাদের অন্য কোনো ব্যাকআপ বা পার্সোনাল একাউন্ট <strong>নেই।</strong></p>
</div>

<div class="step fake-step critical">
<h4><span class="step-num">২</span> প্রধান ভুয়া একাউন্ট <span class="step-badge danger">BIGGEST FRAUD</span></h4>
<p><strong>নকল ইউজারনেম:</strong> <span class="step-un">@baiilla_mach</span></p>
<p class="spell-note">⚠️ বানান খেয়াল করুন: একটি <strong>'l'</strong> এবং একটি <strong>'a'</strong> কম আছে</p>
<p>এই একাউন্টটি হুবহু আমাদের <strong>লোগো এবং পোস্ট কপি</strong> করে প্রতারণা করছে। এরা ইনবক্সে নক করে টাকা চাইতে পারে বা ফেক অফার দিতে পারে।</p>
</div>

<div class="step fake-step">
<h4><span class="step-num">৩</span> স্প্যাম ভুয়া একাউন্ট <span class="step-badge warning">SPAM</span></h4>
<p><strong>নকল ইউজারনেম:</strong> <span class="step-un">@hammad_fams0</span></p>
<p>এটি আরেকটি ফেক একাউন্ট যা আমাদের নাম ও ছবি ব্যবহার করে ফলোয়ারদের বিভ্রান্ত করছে। এই ধরনের র্যান্ডম নামের একাউন্টগুলো মূলত স্প্যামিং ও স্ক্যামের উদ্দেশ্যে তৈরি করা হয়।</p>
</div>
</div>

<div class="sec">
<div class="sec-title green-title">
<span class="sec-icon">✅</span> আসল একাউন্ট
<div class="sec-line green-line"></div>
</div>
${D.r.map(a=>`
<div class="card card-verified">
<div class="card-row">
<span class="pbadge pbadge-green">${a.i} ${a.l}</span>
<span class="username">${a.u}</span>
</div>
<span class="tag tag-official">✨ ${a.g}</span>
<div class="btn-group">
<a href="${a.w}" target="_blank" rel="noopener" class="btn btn-follow"><span class="btn-icon">👉</span> ফলো করতে ক্লিক করুন</a>
<button class="btn btn-copy" data-username="${a.u}"><span class="btn-icon">📋</span> ইউজারনেম কপি</button>
</div>
</div>`).join('')}
</div>

<div class="sec">
<div class="sec-title red-title">
<span class="sec-icon">🚨</span> ভুয়া একাউন্ট সমূহ
<div class="sec-line red-line"></div>
</div>
${D.f.map(a=>`
<div class="card card-fake${a.d==='critical'?' critical':''}">
<div class="card-row">
<span class="pbadge pbadge-red">${a.i} ${a.l}</span>
<span class="username">${a.u}</span>
</div>
<span class="tag tag-fake">${a.b}</span>
${a.s?`<div class="ss-box"><img src="${a.s}" alt="" onclick="this.classList.toggle('zoomed')" loading="lazy"><span class="ss-hint">🖱️ ক্লিক করে বড় করে দেখুন</span></div>`:''}
${a.r?`<p class="reason"><strong>⚠️ বিপদ:</strong> ${a.r}</p>`:''}
<div class="btn-group">
<a href="${a.w}" target="_blank" rel="noopener" class="btn btn-report"><span class="btn-icon">🚨</span> রিপোর্ট করতে ক্লিক করুন</a>
<button class="btn btn-copy" data-username="${a.u}"><span class="btn-icon">📋</span> ইউজারনেম কপি</button>
</div>
</div>`).join('')}
</div>

<div class="action-box">
<h3>🛡️ আপনার করণীয়</h3>
<ol>
<li>উপরের ভুয়া একাউন্ট <strong style="color:var(--red)">@baiilla_mach</strong> এবং <strong style="color:var(--red)">@hammad_fams0</strong> এ গিয়ে <strong>"Report → Scam or Fraud"</strong> অপশনে ক্লিক করে রিপোর্ট করুন।</li>
<li>আমাদের অফিসিয়াল পেজ ছাড়া অন্য কোথাও কোনো <strong>পার্সোনাল তথ্য বা টাকা</strong> (বিকাশ/নগদ/রকেট) পাঠাবেন না।</li>
<li>কোনো একাউন্ট সন্দেহজনক মনে হলে শুধুমাত্র উপরের <strong style="color:var(--green)">ফলো বাটন</strong> থেকে আমাদের আসল একাউন্টে যান।</li>
</ol>
<div class="tip">💡 <strong>টিপস:</strong> সন্দেহ হলে সরাসরি এই পেজের অফিসিয়াল লিংক ব্যবহার করে আমাদের সাথে যোগাযোগ করুন।</div>
</div>

</div>

<footer>
<div class="footer-dot"></div>
<p class="footer-text">© ${D.c.n}</p>
<p class="footer-sub">শুধুমাত্র এন্টারটেইনমেন্ট 🎭</p>
<p class="copyright">এই পেজটিই একমাত্র অফিসিয়াল। অন্য সব ভুয়া।</p>
</footer>

<button class="scroll-top" id="scrollTop" title="উপরে যান">↑</button>
<div class="toast" id="toast" style="display:none">✅ কপি হয়েছে</div>

<script>
(function(){
function P(){const c=document.getElementById('particles');if(!c)return;c.innerHTML='';for(let i=0;i<50;i++){const d=document.createElement('div');d.className='particle';d.style.left=Math.random()*100+'%';d.style.top=Math.random()*100+'%';d.style.setProperty('--tx',(Math.random()-0.5)*300+'px');d.style.setProperty('--ty',(Math.random()-0.5)*300+'px');d.style.animationDelay=Math.random()*8+'s';c.appendChild(d)}}
P();

document.querySelectorAll('.btn-copy').forEach(b=>{b.addEventListener('click',function(){const u=this.dataset.username;if(!u)return;navigator.clipboard.writeText(u).then(()=>{this.innerHTML='<span class=btn-icon>✅</span> কপি হয়েছে';this.classList.add('copied');S('✅ কপি হয়েছে: '+u);setTimeout(()=>{this.innerHTML='<span class=btn-icon>📋</span> ইউজারনেম কপি';this.classList.remove('copied')},2000)}).catch(()=>{const t=document.createElement('textarea');t.value=u;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);this.innerHTML='<span class=btn-icon>✅</span> কপি হয়েছে';this.classList.add('copied');S('✅ কপি হয়েছে: '+u);setTimeout(()=>{this.innerHTML='<span class=btn-icon>📋</span> ইউজারনেম কপি';this.classList.remove('copied')},2000)})})});

function S(m){const t=document.getElementById('toast');t.textContent=m;t.style.display='flex';clearTimeout(t._t);t._t=setTimeout(()=>{t.style.display='none'},2500)}

const st=document.getElementById('scrollTop');
window.addEventListener('scroll',()=>{if(window.scrollY>400)st.classList.add('visible');else st.classList.remove('visible')});
st.addEventListener('click',()=>{window.scrollTo({top:0,behavior:'smooth'})});

document.querySelectorAll('.btn').forEach(b=>{b.addEventListener('click',function(e){const r=document.createElement('span');r.className='ripple-effect';const x=e.clientX-this.getBoundingClientRect().left;const y=e.clientY-this.getBoundingClientRect().top;r.style.left=x+'px';r.style.top=y+'px';r.style.width=r.style.height='20px';this.appendChild(r);setTimeout(()=>r.remove(),600)})});

document.addEventListener('keydown',function(e){if(e.key==='Escape'){document.querySelectorAll('.proof-img.zoomed').forEach(i=>i.classList.remove('zoomed'))}});
})();
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
    const pn = url.parse(req.url).pathname;
    if (req.method === 'GET' && pn === '/') {
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
        });
        res.end(H);
    } else if (req.method === 'GET' && pn === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>404</title><style>body{background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;flex-direction:column}h1{font-size:4em;background:linear-gradient(135deg,#ff2450,#ff6d00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}p{color:#666;margin-top:10px}a{color:#ff2450;text-decoration:none;margin-top:20px;padding:10px 24px;border:1px solid #ff2450;border-radius:25px;transition:all .2s}a:hover{background:#ff2450;color:#fff}</style></head><body><h1>৪০৪</h1><p>পেজ পাওয়া যায়নি</p><a href="/">← হোম পেজে ফিরুন</a></body></html>`);
    }
});

server.listen(PORT, () => {
    console.log(`\n✅ SERVER LIVE: http://localhost:${PORT}\n`);
});

process.on('uncaughtException', (err) => {
    console.error('Error:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('Rejection:', reason);
});
