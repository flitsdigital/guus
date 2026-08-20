// Initialize Fixed Underlay Navigation
document.addEventListener("DOMContentLoaded", () => {
initBeforeAfterSplitSlider();
  });
function initBeforeAfterSplitSlider() {
    const splitters = document.querySelectorAll('[data-splitter="wrap"]');
  
    const setupSplitter = (splitter) => {
      const handle = splitter.querySelector('[data-splitter="handle"]');
      const after = splitter.querySelector('[data-splitter="after"]');
  
      let bounds = splitter.getBoundingClientRect();
      let currentPercent = parseFloat(splitter.getAttribute('data-splitter-initial')) || 50;
  
      const setPositions = (percent) => {
        bounds = splitter.getBoundingClientRect();
        const positionX = (percent / 100) * bounds.width;
        gsap.set(handle, { x: positionX, left: "unset" });
        gsap.set(after, { clipPath: `inset(0 0 0 ${percent}%)` });
      };
  
      setPositions(currentPercent);
  
      Draggable.create(handle, {
        type: 'x',
        bounds: splitter,
        cursor: 'ew-resize',
        activeCursor: 'grabbing',
        onDrag() {
          currentPercent = (this.x / bounds.width) * 100;
          gsap.set(after, { clipPath: `inset(0 0 0 ${currentPercent}%)` });
        }
      });
  
      window.addEventListener('resize', () => setPositions(currentPercent));
    };
  
    splitters.forEach(setupSplitter);
  }