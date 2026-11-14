(() => {
  const canvas = document.querySelector(".sky-canvas");
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let width = 0, height = 0, stars = [], raf = 0;
  const mobile = () => window.innerWidth < 700;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px"; canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(mobile() ? 95 : 190, Math.floor(width * height / 6500));
    stars = Array.from({length: count}, () => ({x:Math.random()*width,y:Math.random()*height,r:Math.random()*1.25+.25,a:Math.random()*.55+.2,s:Math.random()*.18+.025,p:Math.random()*Math.PI*2}));
  }
  function draw(t) {
    ctx.clearRect(0,0,width,height);
    const theme = document.body.dataset.theme;
    const tint = theme === "data" ? "171,224,202" : theme === "nerd" ? "213,182,244" : theme === "games" ? "190,178,255" : "190,222,238";
    for (const star of stars) {
      star.x -= star.s;
      if (star.x < -3) { star.x = width+3; star.y = Math.random()*height; }
      const twinkle = .65 + Math.sin(t*.0007 + star.p)*.35;
      ctx.beginPath(); ctx.arc(star.x,star.y,star.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(${tint},${star.a*twinkle})`; ctx.fill();
    }
    if (Math.floor(t/8500) !== Math.floor((t-16)/8500)) {
      const x = Math.random()*width*.7+width*.15, y = Math.random()*height*.35;
      // A brief shooting star is drawn by the next frame's transient overlay.
      shooting = {x,y,life:0};
    }
    if (shooting) {
      shooting.life += 16;
      const k = Math.max(0,1-shooting.life/850);
      ctx.beginPath(); ctx.moveTo(shooting.x,shooting.y); ctx.lineTo(shooting.x-100*k,shooting.y+42*k);
      ctx.strokeStyle = `rgba(${tint},${k*.65})`; ctx.lineWidth=1.2; ctx.stroke();
      if (!k) shooting = null;
    }
    raf = requestAnimationFrame(draw);
  }
  let shooting = null;
  resize(); window.addEventListener("resize", resize, {passive:true}); raf=requestAnimationFrame(draw);
  document.addEventListener("visibilitychange",()=>{if(document.hidden) cancelAnimationFrame(raf); else raf=requestAnimationFrame(draw);});
})();