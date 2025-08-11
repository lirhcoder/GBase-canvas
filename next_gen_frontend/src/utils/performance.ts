export class PerformanceMonitor {
  private timers: Map<string, number> = new Map();
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private fps = 60;

  constructor() {
    this.startFPSMonitoring();
  }

  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      console.warn(`Timer '${name}' was not started`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(name);
    return duration;
  }

  getFPS(): number {
    return Math.round(this.fps);
  }

  private startFPSMonitoring(): void {
    const updateFPS = () => {
      this.frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - this.lastFrameTime >= 1000) {
        this.fps = (this.frameCount * 1000) / (currentTime - this.lastFrameTime);
        this.frameCount = 0;
        this.lastFrameTime = currentTime;
      }
      
      requestAnimationFrame(updateFPS);
    };
    
    requestAnimationFrame(updateFPS);
  }

  getMemoryUsage(): MemoryInfo | null {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  logPerformanceMetrics(): void {
    const memory = this.getMemoryUsage();
    console.group('Performance Metrics');
    console.log(`FPS: ${this.getFPS()}`);
    if (memory) {
      console.log(`Memory Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
    }
    console.groupEnd();
  }
}