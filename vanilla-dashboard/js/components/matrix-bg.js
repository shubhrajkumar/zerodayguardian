export default class MatrixBG {
  constructor(target=document.body) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;z-index:-1;width:100%;height:100%';
    target.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize',()=> this.resize());
    this.resize();
  }
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  start() {
    if (this.animation) cancelAnimationFrame(this.animation);
    const cols = Math.floor(this.canvas.width / 20);
    const ypos = Array(cols).fill(0);
    const draw = () => {
      this.ctx.fillStyle = 'rgba(0,0,0,0.05)';
      this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
      this.ctx.fillStyle = '#0f0';
      ypos.forEach((y,i)=>{
        const text = String.fromCharCode(33 + Math.random() * 94);
        this.ctx.fillText(text, i * 20, y);
        ypos[i] = y > 100 + Math.random() * 10000 ? 0 : y + 20;
      });
      this.animation = requestAnimationFrame(draw);
    };
    draw();
  }
}
