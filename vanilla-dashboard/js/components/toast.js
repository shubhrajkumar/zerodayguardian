export default class Toast {
  constructor(message, duration=3000) {
    this.message = message;
    this.duration = duration;
    this.el = document.createElement('div');
    this.el.className = 'toast';
    this.el.textContent = message;
    this.el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 16px;border-radius:4px;opacity:0;transition:opacity .3s';
  }
  show() {
    document.body.appendChild(this.el);
    requestAnimationFrame(()=>{this.el.style.opacity=1;});
    setTimeout(()=>this.hide(), this.duration);
  }
  hide() { this.el.style.opacity=0; setTimeout(()=>this.el.remove(),300); }
}
