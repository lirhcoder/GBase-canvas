class WebSAMAnnotator {
    constructor() {
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.image = new Image();
        
        // 标注数据
        this.currentMode = 'point';
        this.currentPoints = [];
        this.currentBoxes = [];
        this.currentMask = null;
        this.annotations = [];
        
        // 交互状态
        this.isDrawingBox = false;
        this.boxStart = null;
        this.scale = 1;
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.loadImage();
        await this.initializeSAM();
    }
    
    async initializeSAM() {
        try {
            this.updateStatus('正在初始化SAM模型...', 'info');
            const response = await fetch('/api/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_path: 'lumine-yurakucho.png' })
            });
            
            const result = await response.json();
            if (result.success) {
                this.updateStatus('SAM模型初始化完成！开始标注吧。', 'success');
                this.samInitialized = true;
            } else {
                this.updateStatus(`SAM初始化失败: ${result.message}`, 'error');
                this.samInitialized = false;
            }
        } catch (error) {
            console.error('SAM initialization error:', error);
            this.updateStatus('无法连接到SAM服务，将使用模拟模式', 'error');
            this.samInitialized = false;
        }
    }
    
    setupEventListeners() {
        // 模式切换
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
            });
        });
        
        // 画布事件
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onCanvasRightClick(e));
        this.canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onCanvasMouseUp(e));
        this.canvas.addEventListener('mousemove', (e) => this.updateCoordinateDisplay(e));
        
        // 阻止右键菜单
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    loadImage() {
        this.image.onload = () => {
            this.setupCanvas();
            this.drawImage();
        };
        this.image.src = 'lumine-yurakucho.png';
    }
    
    setupCanvas() {
        // 计算合适的显示尺寸
        const maxWidth = 800;
        const maxHeight = 600;
        
        let displayWidth = this.image.width;
        let displayHeight = this.image.height;
        
        if (displayWidth > maxWidth) {
            this.scale = maxWidth / displayWidth;
            displayWidth = maxWidth;
            displayHeight = displayHeight * this.scale;
        }
        
        if (displayHeight > maxHeight) {
            this.scale = maxHeight / this.image.height;
            displayWidth = this.image.width * this.scale;
            displayHeight = maxHeight;
        }
        
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        
        console.log(`Image loaded: ${this.image.width}x${this.image.height}, Display: ${displayWidth}x${displayHeight}, Scale: ${this.scale}`);
    }
    
    drawImage() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制当前输入
        this.drawCurrentInputs();
        
        // 绘制当前掩码
        if (this.currentMask) {
            this.drawMask(this.currentMask, 'rgba(255, 255, 0, 0.5)');
        }
        
        // 绘制已保存的标注
        this.drawAnnotations();
    }
    
    drawCurrentInputs() {
        // 绘制点
        this.currentPoints.forEach((point, index) => {
            const x = point.x * this.scale;
            const y = point.y * this.scale;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
            this.ctx.fillStyle = point.label === 1 ? '#4CAF50' : '#f44336';
            this.ctx.fill();
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // 绘制编号
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(index + 1, x, y + 4);
        });
        
        // 绘制框
        this.currentBoxes.forEach(box => {
            const x = box.x * this.scale;
            const y = box.y * this.scale;
            const width = box.width * this.scale;
            const height = box.height * this.scale;
            
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, width, height);
            
            this.ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
            this.ctx.fillRect(x, y, width, height);
        });
    }
    
    drawMask(mask, color = 'rgba(255, 255, 0, 0.5)') {
        // 高质量掩码渲染（参考官方演示）
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = this.canvas.width;
        offscreenCanvas.height = this.canvas.height;
        const offCtx = offscreenCanvas.getContext('2d');
        
        // 创建掩码路径
        const path = new Path2D();
        
        // 查找轮廓并创建平滑路径
        const contours = this.extractMaskContours(mask);
        contours.forEach(contour => {
            if (contour.length > 2) {
                const scaledContour = contour.map(point => ({
                    x: point.x * this.scale,
                    y: point.y * this.scale
                }));
                
                // 使用贝塞尔曲线创建平滑路径
                this.addSmoothPathToPath2D(path, scaledContour);
            }
        });
        
        // 绘制高质量掩码
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over';
        
        // 填充
        this.ctx.fillStyle = color;
        this.ctx.fill(path);
        
        // 边框
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke(path);
        
        this.ctx.restore();
    }
    
    extractMaskContours(mask) {
        // 简化的轮廓提取
        const contours = [];
        const visited = new Set();
        
        for (let y = 1; y < mask.height - 1; y++) {
            for (let x = 1; x < mask.width - 1; x++) {
                const idx = y * mask.width + x;
                const key = `${x},${y}`;
                
                if (mask.data[idx] > 0 && !visited.has(key)) {
                    const contour = this.traceContour(mask, x, y, visited);
                    if (contour.length > 10) {
                        contours.push(contour);
                    }
                }
            }
        }
        
        return contours;
    }
    
    traceContour(mask, startX, startY, visited) {
        const contour = [];
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
        
        let x = startX, y = startY;
        let steps = 0;
        const maxSteps = Math.min(mask.width * mask.height, 1000);
        
        while (steps < maxSteps) {
            const key = `${x},${y}`;
            if (visited.has(key)) break;
            
            visited.add(key);
            contour.push({x, y});
            
            // 寻找下一个边界点
            let found = false;
            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < mask.width && ny >= 0 && ny < mask.height) {
                    const idx = ny * mask.width + nx;
                    if (mask.data[idx] > 0 && !visited.has(`${nx},${ny}`)) {
                        x = nx;
                        y = ny;
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) break;
            steps++;
        }
        
        return contour;
    }
    
    addSmoothPathToPath2D(path, points) {
        if (points.length < 3) return;
        
        path.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length - 2; i++) {
            const cp1x = (points[i].x + points[i + 1].x) / 2;
            const cp1y = (points[i].y + points[i + 1].y) / 2;
            path.quadraticCurveTo(points[i].x, points[i].y, cp1x, cp1y);
        }
        
        path.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        path.closePath();
    }
    
    drawAnnotations() {
        this.annotations.forEach((annotation, index) => {
            if (annotation.polygon) {
                // 绘制多边形
                this.ctx.beginPath();
                const firstPoint = annotation.polygon[0];
                this.ctx.moveTo(firstPoint.x * this.scale, firstPoint.y * this.scale);
                
                annotation.polygon.forEach(point => {
                    this.ctx.lineTo(point.x * this.scale, point.y * this.scale);
                });
                this.ctx.closePath();
                
                // 填充
                this.ctx.fillStyle = this.hexToRgba(annotation.color, 0.3);
                this.ctx.fill();
                
                // 边框
                this.ctx.strokeStyle = annotation.color;
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
                
                // 标签
                if (annotation.center) {
                    const centerX = annotation.center.x * this.scale;
                    const centerY = annotation.center.y * this.scale;
                    
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    this.ctx.fillRect(centerX - 40, centerY - 10, 80, 20);
                    
                    this.ctx.fillStyle = '#333';
                    this.ctx.font = 'bold 12px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(annotation.name, centerX, centerY + 4);
                }
            }
        });
    }
    
    switchMode(mode) {
        this.currentMode = mode;
        
        // 更新按钮状态
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
        // 清除当前输入
        this.clearCurrentInputs();
        
        // 更新状态消息
        const statusMsg = mode === 'point' ? 
            '点击模式: 左键添加正样本点，右键添加负样本点' : 
            '框选模式: 拖拽鼠标选择区域';
        this.updateStatus(statusMsg, 'info');
        
        this.updateCoordinateDisplay();
    }
    
    onCanvasClick(e) {
        if (this.currentMode === 'point') {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.scale;
            const y = (e.clientY - rect.top) / this.scale;
            
            this.currentPoints.push({
                x: x,
                y: y,
                label: 1 // 正样本
            });
            
            // 显示色块预处理预览（参考官方演示）
            this.showColorBlockPreview(x, y);
            
            this.updateCurrentInputsDisplay();
            this.drawImage();
            this.checkGenerateButton();
        }
    }
    
    onCanvasRightClick(e) {
        e.preventDefault();
        
        if (this.currentMode === 'point') {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.scale;
            const y = (e.clientY - rect.top) / this.scale;
            
            this.currentPoints.push({
                x: x,
                y: y,
                label: 0 // 负样本
            });
            
            this.updateCurrentInputsDisplay();
            this.drawImage();
            this.checkGenerateButton();
        }
    }
    
    onCanvasMouseDown(e) {
        if (this.currentMode === 'box' && e.button === 0) {
            const rect = this.canvas.getBoundingClientRect();
            this.boxStart = {
                x: (e.clientX - rect.left) / this.scale,
                y: (e.clientY - rect.top) / this.scale
            };
            this.isDrawingBox = true;
        }
    }
    
    onCanvasMouseMove(e) {
        if (this.currentMode === 'box' && this.isDrawingBox && this.boxStart) {
            const rect = this.canvas.getBoundingClientRect();
            const currentX = (e.clientX - rect.left) / this.scale;
            const currentY = (e.clientY - rect.top) / this.scale;
            
            // 重绘图像
            this.drawImage();
            
            // 绘制临时框
            const x = Math.min(this.boxStart.x, currentX) * this.scale;
            const y = Math.min(this.boxStart.y, currentY) * this.scale;
            const width = Math.abs(currentX - this.boxStart.x) * this.scale;
            const height = Math.abs(currentY - this.boxStart.y) * this.scale;
            
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(x, y, width, height);
            this.ctx.setLineDash([]);
        }
    }
    
    onCanvasMouseUp(e) {
        if (this.currentMode === 'box' && this.isDrawingBox && this.boxStart) {
            const rect = this.canvas.getBoundingClientRect();
            const endX = (e.clientX - rect.left) / this.scale;
            const endY = (e.clientY - rect.top) / this.scale;
            
            const x = Math.min(this.boxStart.x, endX);
            const y = Math.min(this.boxStart.y, endY);
            const width = Math.abs(endX - this.boxStart.x);
            const height = Math.abs(endY - this.boxStart.y);
            
            // 只有当框足够大时才添加
            if (width > 10 && height > 10) {
                this.currentBoxes.push({ x, y, width, height });
                this.updateCurrentInputsDisplay();
                this.checkGenerateButton();
            }
            
            this.isDrawingBox = false;
            this.boxStart = null;
            this.drawImage();
        }
    }
    
    updateCoordinateDisplay(e) {
        const coordDisplay = document.getElementById('coordDisplay');
        if (e) {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.round((e.clientX - rect.left) / this.scale);
            const y = Math.round((e.clientY - rect.top) / this.scale);
            
            let modeText = this.currentMode === 'point' ? '点击' : '框选';
            let actionText = this.currentMode === 'point' ? 
                '左键=正样本, 右键=负样本' : '拖拽选择区域';
            
            coordDisplay.textContent = `坐标: (${x}, ${y}) | 模式: ${modeText} | 操作: ${actionText}`;
        }
    }
    
    updateCurrentInputsDisplay() {
        const container = document.getElementById('currentInputs');
        let html = '';
        
        if (this.currentPoints.length > 0) {
            html += '<div><strong>点击点:</strong></div>';
            this.currentPoints.forEach((point, index) => {
                const type = point.label === 1 ? '正样本' : '负样本';
                const color = point.label === 1 ? 'point-positive' : 'point-negative';
                html += `<div class="point-item">
                    <span class="${color}">${index + 1}. (${Math.round(point.x)}, ${Math.round(point.y)}) - ${type}</span>
                </div>`;
            });
        }
        
        if (this.currentBoxes.length > 0) {
            html += '<div><strong>选择框:</strong></div>';
            this.currentBoxes.forEach((box, index) => {
                html += `<div class="point-item">
                    <span>框 ${index + 1}: (${Math.round(box.x)}, ${Math.round(box.y)}) ${Math.round(box.width)}×${Math.round(box.height)}</span>
                </div>`;
            });
        }
        
        if (html === '') {
            html = '<div>点击图像添加标注点</div>';
        }
        
        container.innerHTML = html;
    }
    
    checkGenerateButton() {
        const hasInput = this.currentPoints.length > 0 || this.currentBoxes.length > 0;
        document.getElementById('generateBtn').disabled = !hasInput;
    }
    
    updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.className = `status status-${type}`;
    }
    
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    clearCurrentInputs() {
        this.currentPoints = [];
        this.currentBoxes = [];
        this.currentMask = null;
        
        this.updateCurrentInputsDisplay();
        this.drawImage();
        this.checkGenerateButton();
        
        document.getElementById('saveBtn').disabled = true;
        this.updateStatus('已清除当前输入', 'info');
    }
    
    updateAnnotationsList() {
        const container = document.getElementById('annotationsList');
        const count = document.getElementById('annotationCount');
        
        count.textContent = this.annotations.length;
        
        if (this.annotations.length === 0) {
            container.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">暂无标注数据</div>';
        } else {
            let html = '';
            this.annotations.forEach((annotation, index) => {
                html += `
                    <div class="annotation-item">
                        <div class="annotation-content">
                            <div class="annotation-name">${annotation.name}</div>
                            <div class="annotation-category">${annotation.category}</div>
                        </div>
                        <div class="annotation-actions">
                            <button class="btn-small btn-info" onclick="showAnnotationDetails(${index})" title="详情">
                                📍
                            </button>
                            <button class="btn-small btn-danger" onclick="deleteAnnotation(${index})" title="删除">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        
        document.getElementById('exportBtn').disabled = this.annotations.length === 0;
    }
    
    showMaskSelector(masks, shape) {
        // 创建掩码选择器（参考官方演示）
        const selectorContainer = document.getElementById('maskSelector') || this.createMaskSelector();
        
        let html = '<div><strong>🎭 选择最佳掩码:</strong></div>';
        masks.forEach((maskData, index) => {
            const isSelected = maskData.is_best ? 'selected' : '';
            html += `
                <div class="mask-option ${isSelected}" onclick="selectMask(${index})">
                    <span>掩码 ${index + 1}</span>
                    <span class="mask-score">置信度: ${maskData.score.toFixed(3)}</span>
                    <span class="mask-area">面积: ${maskData.area}</span>
                    ${maskData.is_best ? '<span class="best-badge">推荐</span>' : ''}
                </div>
            `;
        });
        
        selectorContainer.innerHTML = html;
        selectorContainer.style.display = 'block';
    }
    
    createMaskSelector() {
        const selector = document.createElement('div');
        selector.id = 'maskSelector';
        selector.className = 'mask-selector';
        
        // 插入到当前输入区域后面
        const currentInputsSection = document.getElementById('currentInputs').parentElement;
        currentInputsSection.insertAdjacentElement('afterend', selector);
        
        return selector;
    }
    
    selectMask(index) {
        if (this.allMasks && this.allMasks[index]) {
            const selectedMask = this.allMasks[index];
            const [height, width] = [this.currentMask.height, this.currentMask.width];
            
            this.currentMask = {
                width: width,
                height: height,
                data: new Uint8Array(selectedMask.mask.flat()),
                score: selectedMask.score,
                area: selectedMask.area
            };
            
            this.currentMaskIndex = index;
            this.drawImage();
            this.updateStatus(`已选择掩码 ${index + 1}，置信度: ${selectedMask.score.toFixed(3)}`, 'success');
            
            // 更新选择状态
            document.querySelectorAll('.mask-option').forEach((option, i) => {
                option.classList.toggle('selected', i === index);
            });
        }
    }
    
    showColorBlockPreview(x, y) {
        // 简化的色块预处理预览（参考官方演示）
        try {
            // 获取点击位置的颜色
            const imageData = this.ctx.getImageData(x * this.scale, y * this.scale, 1, 1);
            const clickColor = imageData.data;
            
            // 创建临时图层显示相似颜色区域
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // 获取整个画布的图像数据
            const fullImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = fullImageData.data;
            
            // 颜色相似度阈值
            const colorThreshold = 50;
            
            // 创建高亮图层
            const highlightData = tempCtx.createImageData(this.canvas.width, this.canvas.height);
            const highlightPixels = highlightData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // 计算颜色距离
                const colorDistance = Math.sqrt(
                    Math.pow(r - clickColor[0], 2) +
                    Math.pow(g - clickColor[1], 2) +
                    Math.pow(b - clickColor[2], 2)
                );
                
                if (colorDistance <= colorThreshold) {
                    // 相似颜色用半透明蓝色高亮
                    highlightPixels[i] = 100;     // R
                    highlightPixels[i + 1] = 150; // G
                    highlightPixels[i + 2] = 255; // B
                    highlightPixels[i + 3] = 80;  // A (半透明)
                } else {
                    // 其他区域完全透明
                    highlightPixels[i + 3] = 0;
                }
            }
            
            tempCtx.putImageData(highlightData, 0, 0);
            
            // 在主画布上绘制高亮图层
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.drawImage(tempCanvas, 0, 0);
            this.ctx.restore();
            
            // 1秒后清除预览
            setTimeout(() => {
                this.drawImage();
            }, 1000);
            
        } catch (error) {
            console.warn('色块预览失败:', error);
        }
    }
    
    detectStoreName() {
        // 简单的店铺名称自动识别（基于常见的日文店铺名称）
        if (!this.currentMask) {
            return null;
        }
        
        // 计算掩码的中心点
        const center = this.calculateMaskCenter(this.currentMask);
        if (!center) {
            return null;
        }
        
        const x = center.x;
        const y = center.y;
        
        console.log(`检测店铺名称 - 中心点: (${x}, ${y})`);
        
        // 根据实际校准结果重新映射店铺名称
        // 基于掩码中心点的精确位置匹配
        
        // 中心区域大店铺 - 掩码中心约 (325, 158)
        if (x >= 300 && x <= 350 && y >= 140 && y <= 180) {
            return "シルパイ シルスチュアート";
        } 
        // 右上区域店铺 - 掩码中心约 (440, 161)  
        else if (x >= 420 && x <= 460 && y >= 150 && y <= 170) {
            return "フランフラン";
        }
        // 左上小区域 - 掩码中心约 (138, 109)
        else if (x >= 120 && x <= 160 && y >= 90 && y <= 130) {
            return "ビームス";
        }
        // 中下区域 - 掩码中心约 (335, 302)
        else if (x >= 320 && x <= 350 && y >= 290 && y <= 320) {
            return "ラグナムーン";
        }
        // 右下区域 - 掩码中心约 (465, 302)
        else if (x >= 450 && x <= 480 && y >= 290 && y <= 320) {
            return "プラダ";
        }
        // 扩大范围以覆盖更多可能的位置
        else if (x >= 400 && x <= 500 && y >= 100 && y <= 200) {
            return "マルニ";
        }
        else if (x >= 150 && x <= 250 && y >= 200 && y <= 300) {
            return "フェンディ";
        }
        else if (x >= 200 && x <= 400 && y >= 350 && y <= 500) {
            return "ユナイテッドアローズ";
        }
        
        return null;
    }
    
    calculateMaskCenter(mask) {
        // 计算掩码中心点
        console.log('计算掩码中心点，掩码类型:', typeof mask, '数据:', mask);
        
        if (!mask) {
            console.log('掩码为空');
            return null;
        }
        
        let sumX = 0, sumY = 0, count = 0;
        
        // 处理来自SAM API的掩码数据结构（二维数组）
        if (Array.isArray(mask) && mask.length > 0 && Array.isArray(mask[0])) {
            const height = mask.length;
            const width = mask[0].length;
            
            console.log(`掩码尺寸: ${width}x${height}`);
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (mask[y][x] > 0) {
                        sumX += x;
                        sumY += y;
                        count++;
                    }
                }
            }
        }
        // 处理其他格式的掩码数据
        else if (mask.data && mask.width && mask.height) {
            console.log(`掩码尺寸 (data格式): ${mask.width}x${mask.height}`);
            
            for (let y = 0; y < mask.height; y++) {
                for (let x = 0; x < mask.width; x++) {
                    const index = y * mask.width + x;
                    if (mask.data[index] > 0) {
                        sumX += x;
                        sumY += y;
                        count++;
                    }
                }
            }
        } else {
            console.log('无法识别的掩码格式');
            return null;
        }
        
        console.log(`找到 ${count} 个掩码像素`);
        
        if (count > 0) {
            const center = {
                x: Math.round(sumX / count),
                y: Math.round(sumY / count)
            };
            console.log(`计算出的中心点: (${center.x}, ${center.y})`);
            return center;
        }
        
        return null;
    }
    
    addInteractiveMask(annotation) {
        // 添加交互式掩码效果
        const maskElement = {
            id: annotation.id,
            annotation: annotation,
            opacity: 0.3,
            isHighlighted: false,
            element: this.createMaskDOMElement(annotation)
        };
        
        if (!this.interactiveMasks) {
            this.interactiveMasks = [];
        }
        
        this.interactiveMasks.push(maskElement);
        
        // 添加事件监听
        this.addMaskEventListeners(maskElement);
        
        console.log('添加交互式掩码:', annotation.name);
    }
    
    createMaskDOMElement(annotation) {
        // 在DOM中创建可交互的掩码元素
        const maskDiv = document.createElement('div');
        maskDiv.className = 'interactive-mask';
        maskDiv.id = `mask-${annotation.id}`;
        maskDiv.style.position = 'absolute';
        maskDiv.style.pointerEvents = 'auto';
        maskDiv.style.cursor = 'pointer';
        maskDiv.style.zIndex = '10';
        
        // 添加到画布容器中
        const canvasContainer = this.canvas.parentElement;
        canvasContainer.style.position = 'relative';
        canvasContainer.appendChild(maskDiv);
        
        return maskDiv;
    }
    
    addMaskEventListeners(maskElement) {
        const element = maskElement.element;
        const annotation = maskElement.annotation;
        
        // 鼠标悬停效果
        element.addEventListener('mouseenter', () => {
            this.highlightMask(maskElement, true);
            this.showStoreTooltip(annotation);
        });
        
        element.addEventListener('mouseleave', () => {
            this.highlightMask(maskElement, false);
            this.hideStoreTooltip();
        });
        
        // 点击效果
        element.addEventListener('click', () => {
            this.selectStore(annotation);
        });
    }
    
    highlightMask(maskElement, highlight) {
        maskElement.isHighlighted = highlight;
        
        if (highlight) {
            // 高亮效果：降低透明度，添加发光效果
            maskElement.opacity = 0.7;
            this.animateMaskAttention(maskElement);
        } else {
            // 恢复正常
            maskElement.opacity = 0.3;
        }
        
        // 重新绘制掩码
        this.updateMaskVisual(maskElement);
    }
    
    animateMaskAttention(maskElement) {
        // 吸引注意的动画效果
        let pulseCount = 0;
        const maxPulses = 3;
        
        const pulse = () => {
            if (pulseCount >= maxPulses) return;
            
            // 脉冲效果
            maskElement.opacity = 0.9;
            this.updateMaskVisual(maskElement);
            
            setTimeout(() => {
                maskElement.opacity = 0.5;
                this.updateMaskVisual(maskElement);
                pulseCount++;
                
                if (pulseCount < maxPulses) {
                    setTimeout(pulse, 300);
                }
            }, 200);
        };
        
        pulse();
    }
    
    updateMaskVisual(maskElement) {
        // 更新掩码的视觉效果
        const annotation = maskElement.annotation;
        
        // 重新绘制该掩码区域
        this.drawSingleMask(annotation, maskElement.opacity);
    }
    
    drawSingleMask(annotation, opacity) {
        // 绘制单个掩码（用于交互效果）
        if (!annotation.polygon) return;
        
        this.ctx.save();
        
        // 创建路径
        const path = new Path2D();
        const scaledPolygon = annotation.polygon.map(point => ({
            x: point.x * this.scale,
            y: point.y * this.scale
        }));
        
        this.addSmoothPathToPath2D(path, scaledPolygon);
        
        // 绘制填充
        const color = this.hexToRgba(annotation.color, opacity);
        this.ctx.fillStyle = color;
        this.ctx.fill(path);
        
        // 绘制边框
        this.ctx.strokeStyle = annotation.color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke(path);
        
        this.ctx.restore();
    }
    
    showStoreTooltip(annotation) {
        // 显示店铺信息提示
        const tooltip = document.getElementById('storeTooltip') || this.createTooltip();
        
        tooltip.innerHTML = `
            <div class="tooltip-name">${annotation.name}</div>
            <div class="tooltip-category">${annotation.category}</div>
            <div class="tooltip-center">中心点: (${annotation.centerPoint.x}, ${annotation.centerPoint.y})</div>
            <div class="tooltip-area">面积: ${annotation.area} 像素</div>
        `;
        
        tooltip.style.display = 'block';
    }
    
    createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.id = 'storeTooltip';
        tooltip.className = 'store-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
            display: none;
        `;
        document.body.appendChild(tooltip);
        return tooltip;
    }
    
    hideStoreTooltip() {
        const tooltip = document.getElementById('storeTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    selectStore(annotation) {
        // 选择店铺
        console.log('选择店铺:', annotation);
        this.updateStatus(`已选择店铺: ${annotation.name}`, 'info');
        
        // 显示详细信息
        this.showStoreDetails(annotation);
    }
    
    showStoreDetails(annotation) {
        // 显示店铺详细信息
        const details = {
            名称: annotation.name,
            类别: annotation.category,
            中心点坐标: `(${annotation.centerPoint.x}, ${annotation.centerPoint.y})`,
            边界框: `x:${annotation.bbox.x}, y:${annotation.bbox.y}, w:${annotation.bbox.width}, h:${annotation.bbox.height}`,
            面积: `${annotation.area} 像素`,
            边界点数量: annotation.boundaryPoints.length,
            掩码坐标点数: annotation.maskCoordinates ? annotation.maskCoordinates.length : 0,
            创建时间: new Date(annotation.timestamp).toLocaleString()
        };
        
        let detailsText = '店铺详细信息:\n';
        for (const [key, value] of Object.entries(details)) {
            detailsText += `${key}: ${value}\n`;
        }
        
        console.log(detailsText);
        alert(detailsText);
    }
}

// 全局变量
let annotator;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    annotator = new WebSAMAnnotator();
});

// 真实的SAM预测函数
async function simulateSAM() {
    if (!annotator.currentPoints.length && !annotator.currentBoxes.length) {
        annotator.updateStatus('请先添加点或框！', 'error');
        return;
    }
    
    annotator.updateStatus('正在使用SAM生成掩码...', 'info');
    
    try {
        // 准备数据
        const requestData = {};
        
        if (annotator.currentPoints.length > 0) {
            requestData.points = annotator.currentPoints.map(p => [p.x, p.y]);
            requestData.point_labels = annotator.currentPoints.map(p => p.label);
        }
        
        if (annotator.currentBoxes.length > 0) {
            // 只使用第一个框
            const box = annotator.currentBoxes[0];
            requestData.boxes = [[box.x, box.y, box.x + box.width, box.y + box.height]];
        }
        
        if (annotator.samInitialized) {
            // 调用真实的SAM API
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 处理SAM返回的多掩码结果（参考官方演示）
                if (result.masks && result.masks.length > 0) {
                    annotator.allMasks = result.masks;
                    annotator.currentMaskIndex = 0;
                    
                    // 使用最佳掩码
                    const bestMaskData = result.masks.find(m => m.is_best) || result.masks[0];
                    const [height, width] = result.shape;
                    
                    annotator.currentMask = {
                        width: width,
                        height: height,
                        data: new Uint8Array(bestMaskData.mask.flat()),
                        score: bestMaskData.score,
                        area: bestMaskData.area
                    };
                    
                    annotator.drawImage();
                    annotator.showMaskSelector(result.masks, result.shape);
                    annotator.updateStatus(`SAM生成${result.num_masks}个掩码候选！当前: ${bestMaskData.score.toFixed(3)}`, 'success');
                    document.getElementById('saveBtn').disabled = false;
                } else {
                    throw new Error('无效的掩码数据');
                }
            } else {
                throw new Error(result.message);
            }
        } else {
            // 回退到模拟模式
            await simulateSAMFallback();
        }
        
    } catch (error) {
        console.error('SAM prediction error:', error);
        annotator.updateStatus('SAM预测失败，使用模拟模式', 'error');
        await simulateSAMFallback();
    }
}

// 模拟SAM的回退函数
async function simulateSAMFallback() {
    return new Promise((resolve) => {
        setTimeout(() => {
            // 创建模拟掩码
            let maskBounds;
            
            if (annotator.currentBoxes.length > 0) {
                // 使用框
                const box = annotator.currentBoxes[0];
                maskBounds = {
                    x: Math.floor(box.x),
                    y: Math.floor(box.y),
                    width: Math.floor(box.width),
                    height: Math.floor(box.height)
                };
            } else {
                // 使用点创建区域
                const points = annotator.currentPoints.filter(p => p.label === 1);
                if (points.length === 0) {
                    annotator.updateStatus('需要至少一个正样本点！', 'error');
                    resolve();
                    return;
                }
                
                const xs = points.map(p => p.x);
                const ys = points.map(p => p.y);
                const minX = Math.min(...xs) - 50;
                const minY = Math.min(...ys) - 50;
                const maxX = Math.max(...xs) + 50;
                const maxY = Math.max(...ys) + 50;
                
                maskBounds = {
                    x: Math.max(0, Math.floor(minX)),
                    y: Math.max(0, Math.floor(minY)),
                    width: Math.floor(maxX - minX),
                    height: Math.floor(maxY - minY)
                };
            }
            
            // 创建模拟掩码数据
            annotator.currentMask = {
                width: annotator.image.width,
                height: annotator.image.height,
                data: new Uint8Array(annotator.image.width * annotator.image.height),
                bounds: maskBounds,
                score: 0.85
            };
            
            // 填充掩码区域
            for (let y = maskBounds.y; y < maskBounds.y + maskBounds.height && y < annotator.image.height; y++) {
                for (let x = maskBounds.x; x < maskBounds.x + maskBounds.width && x < annotator.image.width; x++) {
                    annotator.currentMask.data[y * annotator.image.width + x] = 255;
                }
            }
            
            annotator.drawImage();
            annotator.updateStatus('模拟掩码生成完成！请输入店铺信息并保存。', 'success');
            document.getElementById('saveBtn').disabled = false;
            resolve();
            
        }, 1000);
    });
}

function clearCurrent() {
    annotator.clearCurrentInputs();
}

function saveAnnotation() {
    let name = document.getElementById('storeName').value.trim();
    const category = document.getElementById('storeCategory').value;
    
    if (!name) {
        // 尝试自动识别店铺名称
        const autoName = annotator.detectStoreName();
        if (autoName) {
            document.getElementById('storeName').value = autoName;
            annotator.updateStatus(`自动检测到店铺名称: ${autoName}，正在自动保存...`, 'info');
            // 使用检测到的名称继续保存
            name = autoName;
        } else {
            annotator.updateStatus('请输入店铺名称！', 'error');
            return;
        }
    }
    
    if (!annotator.currentMask) {
        annotator.updateStatus('请先生成掩码！', 'error');
        return;
    }
    
    // 从掩码生成多边形和坐标数据
    const polygon = generatePolygonFromMask(annotator.currentMask);
    const center = calculateCenter(polygon);
    const bbox = calculateBoundingBox(polygon);
    
    // 获取掩码的详细坐标数据
    const maskCoordinates = extractMaskCoordinates(annotator.currentMask);
    
    const categoryColors = {
        "レディスファッション": "#FFB6C1",
        "インテリア・生活雑貨": "#ADD8E6",
        "ファッション雑貨": "#98FB98"
    };
    
    const annotation = {
        id: `store_${annotator.annotations.length}`,
        name: name,
        category: category,
        color: categoryColors[category],
        bbox: bbox,
        polygon: polygon,
        center: center,
        area: annotator.currentMask.area || calculatePolygonArea(polygon),
        // 新增坐标数据
        centerPoint: center,  // 店铺中心点
        maskCoordinates: maskCoordinates,  // 掩码坐标集合
        boundaryPoints: polygon,  // 边界点坐标
        timestamp: new Date().toISOString()
    };
    
    annotator.annotations.push(annotation);
    
    // 添加交互式掩码效果
    annotator.addInteractiveMask(annotation);
    
    // 清除当前输入
    clearCurrent();
    
    // 清空输入框
    document.getElementById('storeName').value = '';
    
    // 更新列表
    annotator.updateAnnotationsList();
    annotator.drawImage();
    
    annotator.updateStatus(`店铺 "${name}" 标注保存成功！中心点: (${center.x}, ${center.y})`, 'success');
    
    console.log('保存的店铺数据:', annotation);
}

function generatePolygonFromMask(mask) {
    // 处理真实SAM掩码数据
    if (mask.data && mask.width && mask.height) {
        // 创建二值图像用于轮廓检测
        const binary = new Uint8Array(mask.width * mask.height);
        
        for (let i = 0; i < mask.data.length; i++) {
            binary[i] = mask.data[i] > 0 ? 255 : 0;
        }
        
        // 查找边界点 - 简化的轮廓检测
        const contourPoints = [];
        
        // 扫描边界
        for (let y = 1; y < mask.height - 1; y++) {
            for (let x = 1; x < mask.width - 1; x++) {
                const idx = y * mask.width + x;
                
                if (binary[idx] > 0) {
                    // 检查是否为边界点
                    const neighbors = [
                        binary[idx - 1], // 左
                        binary[idx + 1], // 右
                        binary[idx - mask.width], // 上
                        binary[idx + mask.width]  // 下
                    ];
                    
                    if (neighbors.some(n => n === 0)) {
                        contourPoints.push({ x, y });
                    }
                }
            }
        }
        
        // 如果找到边界点，进行简化
        if (contourPoints.length > 4) {
            // 简化轮廓 - 每隔几个点取一个
            const step = Math.max(1, Math.floor(contourPoints.length / 20));
            const simplified = [];
            for (let i = 0; i < contourPoints.length; i += step) {
                simplified.push(contourPoints[i]);
            }
            return simplified.length > 3 ? simplified : contourPoints.slice(0, 8);
        } else if (contourPoints.length > 0) {
            return contourPoints;
        }
    }
    
    // 回退：使用边界矩形
    const bounds = mask.bounds || { x: 0, y: 0, width: 100, height: 100 };
    return [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        { x: bounds.x, y: bounds.y + bounds.height }
    ];
}

function calculateCenter(polygon) {
    const x = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
    const y = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
    return { x: Math.round(x), y: Math.round(y) };
}

function calculateBoundingBox(polygon) {
    const xs = polygon.map(p => p.x);
    const ys = polygon.map(p => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const width = Math.max(...xs) - x;
    const height = Math.max(...ys) - y;
    return { x, y, width, height };
}

function exportData() {
    if (annotator.annotations.length === 0) {
        annotator.updateStatus('没有标注数据可导出！', 'error');
        return;
    }
    
    const exportData = {
        image_dimensions: {
            width: annotator.image.width,
            height: annotator.image.height
        },
        extraction_method: "web_interactive_sam_annotation",
        categories: {
            "レディスファッション": { "color": "#FFB6C1", "label": "Ladies Fashion" },
            "インテリア・生活雑貨": { "color": "#ADD8E6", "label": "Interior & Lifestyle" },
            "ファッション雑貨": { "color": "#98FB98", "label": "Fashion Accessories" }
        },
        stores: annotator.annotations
    };
    
    // 下载JSON文件
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'web_sam_annotations.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    annotator.updateStatus(`已导出 ${annotator.annotations.length} 个店铺标注！`, 'success');
}

function clearAll() {
    if (confirm('确定要清空所有标注数据吗？此操作无法撤销。')) {
        annotator.annotations = [];
        clearCurrent();
        annotator.updateAnnotationsList();
        annotator.drawImage();
        annotator.updateStatus('已清空所有标注数据', 'info');
    }
}

function selectMask(index) {
    annotator.selectMask(index);
}

// 提取掩码的详细坐标数据
function extractMaskCoordinates(mask) {
    const coordinates = [];
    
    if (mask && mask.data && mask.width && mask.height) {
        for (let y = 0; y < mask.height; y++) {
            for (let x = 0; x < mask.width; x++) {
                const index = y * mask.width + x;
                if (mask.data[index] > 0) {
                    coordinates.push({x: x, y: y});
                }
            }
        }
    }
    
    return coordinates;
}

// 计算多边形面积
function calculatePolygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        area += polygon[i].x * polygon[j].y;
        area -= polygon[j].x * polygon[i].y;
    }
    
    return Math.abs(area / 2);
}

// 控制函数
function updateMaskOpacity(value) {
    const opacity = parseFloat(value);
    document.getElementById('opacityValue').textContent = Math.round(opacity * 100) + '%';
    
    if (annotator && annotator.interactiveMasks) {
        annotator.interactiveMasks.forEach(maskElement => {
            if (!maskElement.isHighlighted) {
                maskElement.opacity = opacity;
                annotator.updateMaskVisual(maskElement);
            }
        });
    }
    
    // 重新绘制所有掩码
    annotator.drawImage();
}

function toggleMaskAnimation(enabled) {
    if (annotator) {
        annotator.animationEnabled = enabled;
        console.log('掩码动画效果:', enabled ? '启用' : '禁用');
    }
}

function toggleCoordinateDisplay(enabled) {
    if (annotator) {
        annotator.showCoordinates = enabled;
        annotator.drawImage();
        console.log('坐标显示:', enabled ? '启用' : '禁用');
    }
}

function showAllStoreCoordinates() {
    if (!annotator || !annotator.annotations || annotator.annotations.length === 0) {
        alert('没有已标注的店铺数据');
        return;
    }
    
    let coordsText = '所有店铺坐标信息:\n\n';
    
    annotator.annotations.forEach((annotation, index) => {
        coordsText += `${index + 1}. ${annotation.name}\n`;
        coordsText += `   类别: ${annotation.category}\n`;
        coordsText += `   中心点: (${annotation.centerPoint.x}, ${annotation.centerPoint.y})\n`;
        coordsText += `   边界框: x:${annotation.bbox.x}, y:${annotation.bbox.y}, w:${annotation.bbox.width}, h:${annotation.bbox.height}\n`;
        coordsText += `   面积: ${annotation.area} 像素\n`;
        coordsText += `   边界点数: ${annotation.boundaryPoints.length}\n`;
        
        if (annotation.maskCoordinates && annotation.maskCoordinates.length > 0) {
            coordsText += `   掩码坐标点数: ${annotation.maskCoordinates.length}\n`;
            coordsText += `   前5个掩码坐标: `;
            for (let i = 0; i < Math.min(5, annotation.maskCoordinates.length); i++) {
                const coord = annotation.maskCoordinates[i];
                coordsText += `(${coord.x},${coord.y})`;
                if (i < Math.min(4, annotation.maskCoordinates.length - 1)) coordsText += ', ';
            }
            if (annotation.maskCoordinates.length > 5) {
                coordsText += '...';
            }
        }
        
        coordsText += '\n\n';
    });
    
    // 显示在弹窗中
    const popup = window.open('', '_blank', 'width=600,height=400,scrollbars=yes');
    popup.document.write(`
        <html>
        <head><title>店铺坐标数据</title></head>
        <body style="font-family: monospace; padding: 20px; background: #f5f5f5;">
            <h2>店铺坐标数据</h2>
            <pre style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #ddd;">${coordsText}</pre>
            <button onclick="
                const data = \`${coordsText}\`;
                const blob = new Blob([data], {type: 'text/plain'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'store_coordinates.txt';
                a.click();
                URL.revokeObjectURL(url);
            " style="padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">
                下载坐标数据
            </button>
        </body>
        </html>
    `);
    
    console.log('店铺坐标数据:', coordsText);
}

// 删除单个标注
function deleteAnnotation(index) {
    if (confirm(`确定要删除标注 "${annotator.annotations[index].name}" 吗？`)) {
        // 移除交互式掩码
        if (annotator.interactiveMasks) {
            const maskToRemove = annotator.interactiveMasks.find(m => m.id === annotator.annotations[index].id);
            if (maskToRemove && maskToRemove.element) {
                maskToRemove.element.remove();
            }
            annotator.interactiveMasks = annotator.interactiveMasks.filter(m => m.id !== annotator.annotations[index].id);
        }
        
        // 移除标注数据
        annotator.annotations.splice(index, 1);
        
        // 更新界面
        annotator.updateAnnotationsList();
        annotator.drawImage();
        
        annotator.updateStatus(`已删除标注`, 'info');
    }
}

// 显示标注详情
function showAnnotationDetails(index) {
    const annotation = annotator.annotations[index];
    
    const details = {
        '店铺名称': annotation.name,
        '类别': annotation.category,
        '中心点': `(${annotation.centerPoint.x}, ${annotation.centerPoint.y})`,
        '边界框': `x:${annotation.bbox.x}, y:${annotation.bbox.y}, w:${annotation.bbox.width}, h:${annotation.bbox.height}`,
        '面积': `${annotation.area} 像素`,
        '边界点数': annotation.boundaryPoints.length,
        '掩码坐标点数': annotation.maskCoordinates ? annotation.maskCoordinates.length : 0,
        '置信度': annotation.confidence || 'N/A',
        '创建时间': new Date(annotation.timestamp).toLocaleString()
    };
    
    let detailsText = '店铺详细信息:\n\n';
    for (const [key, value] of Object.entries(details)) {
        detailsText += `${key}: ${value}\n`;
    }
    
    // 显示前5个坐标点作为示例
    if (annotation.maskCoordinates && annotation.maskCoordinates.length > 0) {
        detailsText += '\n前5个掩码坐标:\n';
        for (let i = 0; i < Math.min(5, annotation.maskCoordinates.length); i++) {
            const coord = annotation.maskCoordinates[i];
            detailsText += `  (${coord.x}, ${coord.y})\n`;
        }
        if (annotation.maskCoordinates.length > 5) {
            detailsText += `  ... 还有 ${annotation.maskCoordinates.length - 5} 个坐标点\n`;
        }
    }
    
    alert(detailsText);
}