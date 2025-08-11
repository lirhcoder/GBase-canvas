class InteractiveMallMap {
    constructor() {
        this.storeData = null;
        this.selectedStore = null;
        this.activeFilters = ['all'];
        this.scaleFactor = 1;
        
        this.init();
    }
    
    async init() {
        try {
            // Load corrected precise store data
            const response = await fetch('output/corrected_store_data.json');
            this.storeData = await response.json();
            
            // Wait for image to load to get correct dimensions
            const mapImage = document.getElementById('mapImage');
            mapImage.onload = () => {
                this.setupMap();
                this.setupFilters();
                this.setupStoreList();
                this.setupLegend();
            };
            
            // If image already loaded
            if (mapImage.complete) {
                this.setupMap();
                this.setupFilters();
                this.setupStoreList();
                this.setupLegend();
            }
            
        } catch (error) {
            console.error('Error loading store data:', error);
            this.showError('Failed to load store data. Please make sure the data file exists.');
        }
    }
    
    setupMap() {
        const mapImage = document.getElementById('mapImage');
        const overlay = document.getElementById('storeOverlay');
        
        // Calculate scale factor between displayed image and original data
        const displayedWidth = mapImage.clientWidth;
        const displayedHeight = mapImage.clientHeight;
        const originalWidth = this.storeData.image_dimensions.width;
        const originalHeight = this.storeData.image_dimensions.height;
        this.scaleFactor = Math.min(displayedWidth / originalWidth, displayedHeight / originalHeight);
        
        // Clear existing overlays
        overlay.innerHTML = '';
        
        // Create SVG overlay
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', displayedWidth);
        svg.setAttribute('height', displayedHeight);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'none';
        
        // Create store areas
        this.storeData.stores.forEach(store => {
            this.createStoreArea(store, overlay, svg);
        });
        
        overlay.appendChild(svg);
        
        // Add click handler for deselecting stores
        overlay.addEventListener('click', (e) => {
            // Only deselect if clicking on empty area (not on a store)
            if (e.target === overlay || e.target === svg) {
                this.deselectAllStores();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(() => this.setupMap(), 100);
        });
    }
    
    createStoreArea(store, overlay, svg) {
        // Create invisible clickable area (div)
        const clickArea = document.createElement('div');
        clickArea.className = 'store-click-area';
        clickArea.dataset.storeId = store.id;
        clickArea.dataset.category = store.category;
        clickArea.style.position = 'absolute';
        clickArea.style.pointerEvents = 'all';
        clickArea.style.cursor = 'pointer';
        clickArea.style.background = 'transparent';
        
        // Scale and position the click area using bbox
        const bbox = store.bbox;
        const scaledX = bbox.x * this.scaleFactor;
        const scaledY = bbox.y * this.scaleFactor;
        const scaledWidth = bbox.width * this.scaleFactor;
        const scaledHeight = bbox.height * this.scaleFactor;
        
        clickArea.style.left = scaledX + 'px';
        clickArea.style.top = scaledY + 'px';
        clickArea.style.width = scaledWidth + 'px';
        clickArea.style.height = scaledHeight + 'px';
        
        // Create SVG polygon for visual representation
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('class', 'store-polygon');
        polygon.dataset.storeId = store.id;
        polygon.dataset.category = store.category;
        
        // Scale polygon points
        const scaledPoints = store.polygon.map(point => 
            `${point.x * this.scaleFactor},${point.y * this.scaleFactor}`
        ).join(' ');
        
        polygon.setAttribute('points', scaledPoints);
        polygon.setAttribute('fill', 'transparent');
        polygon.setAttribute('stroke', 'transparent');
        polygon.setAttribute('stroke-width', '2');
        polygon.style.transition = 'all 0.3s ease';
        polygon.style.pointerEvents = 'none';
        
        // Create label
        const label = document.createElement('div');
        label.className = 'store-label';
        label.textContent = store.name;
        label.style.position = 'absolute';
        label.style.top = '-25px';
        label.style.left = '50%';
        label.style.transform = 'translateX(-50%)';
        label.style.background = 'rgba(255, 255, 255, 0.95)';
        label.style.padding = '4px 8px';
        label.style.borderRadius = '4px';
        label.style.fontSize = '10px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        label.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        label.style.whiteSpace = 'nowrap';
        label.style.opacity = '0';
        label.style.transition = 'opacity 0.3s ease';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '40';
        
        clickArea.appendChild(label);
        
        // Add event listeners to click area
        clickArea.addEventListener('click', (e) => {
            e.preventDefault();
            this.selectStore(store.id);
        });
        
        clickArea.addEventListener('mouseenter', () => {
            this.highlightStore(store.id);
            label.style.opacity = '1';
        });
        
        clickArea.addEventListener('mouseleave', () => {
            if (!clickArea.classList.contains('selected')) {
                this.unhighlightStore(store.id);
            }
            label.style.opacity = '0';
        });
        
        overlay.appendChild(clickArea);
        svg.appendChild(polygon);
    }
    
    setupFilters() {
        const filterContainer = document.getElementById('categoryFilters');
        const categories = Object.keys(this.storeData.categories);
        
        // Add category filter buttons
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.dataset.category = category;
            button.textContent = this.storeData.categories[category].label || category;
            
            button.addEventListener('click', () => {
                this.toggleFilter(category);
            });
            
            filterContainer.appendChild(button);
        });
    }
    
    setupStoreList() {
        const storeList = document.getElementById('storeList');
        
        // Group stores by category
        const storesByCategory = {};
        this.storeData.stores.forEach(store => {
            if (!storesByCategory[store.category]) {
                storesByCategory[store.category] = [];
            }
            storesByCategory[store.category].push(store);
        });
        
        // Create store cards
        Object.entries(storesByCategory).forEach(([category, stores]) => {
            stores.forEach(store => {
                const card = this.createStoreCard(store);
                storeList.appendChild(card);
            });
        });
    }
    
    createStoreCard(store) {
        const card = document.createElement('div');
        card.className = 'store-card';
        card.dataset.storeId = store.id;
        card.dataset.category = store.category;
        
        const name = document.createElement('div');
        name.className = 'store-name';
        name.textContent = store.name;
        
        const category = document.createElement('div');
        category.className = 'store-category';
        category.textContent = store.category;
        category.style.backgroundColor = store.color;
        category.style.color = '#333';
        
        card.appendChild(name);
        card.appendChild(category);
        
        card.addEventListener('click', () => {
            this.selectStore(store.id);
        });
        
        return card;
    }
    
    setupLegend() {
        const legendContent = document.getElementById('legendContent');
        
        Object.entries(this.storeData.categories).forEach(([category, info]) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = info.color;
            
            const text = document.createElement('div');
            text.className = 'legend-text';
            text.textContent = info.label || category;
            
            item.appendChild(colorBox);
            item.appendChild(text);
            legendContent.appendChild(item);
        });
    }
    
    toggleFilter(category) {
        const button = document.querySelector(`[data-category="${category}"]`);
        const allButton = document.querySelector('[data-category="all"]');
        
        if (category === 'all') {
            // Clear all filters and activate 'all'
            this.activeFilters = ['all'];
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            allButton.classList.add('active');
        } else {
            // Toggle category filter
            if (this.activeFilters.includes(category)) {
                this.activeFilters = this.activeFilters.filter(f => f !== category);
                button.classList.remove('active');
            } else {
                this.activeFilters.push(category);
                button.classList.add('active');
            }
            
            // Remove 'all' if specific category is selected
            if (this.activeFilters.includes('all')) {
                this.activeFilters = this.activeFilters.filter(f => f !== 'all');
                allButton.classList.remove('active');
            }
            
            // If no filters, activate 'all'
            if (this.activeFilters.length === 0) {
                this.activeFilters = ['all'];
                allButton.classList.add('active');
            }
        }
        
        this.applyFilters();
    }
    
    applyFilters() {
        const clickAreas = document.querySelectorAll('.store-click-area');
        const polygons = document.querySelectorAll('.store-polygon');
        const storeCards = document.querySelectorAll('.store-card');
        
        // Filter click areas and polygons
        [clickAreas, polygons].forEach(elements => {
            elements.forEach(element => {
                const category = element.dataset.category;
                const shouldShow = this.activeFilters.includes('all') || 
                                 this.activeFilters.includes(category);
                
                element.style.display = shouldShow ? 'block' : 'none';
            });
        });
        
        // Filter store cards
        storeCards.forEach(element => {
            const category = element.dataset.category;
            const shouldShow = this.activeFilters.includes('all') || 
                             this.activeFilters.includes(category);
            
            element.style.display = shouldShow ? 'block' : 'none';
        });
    }
    
    selectStore(storeId) {
        // Clear previous selection from all elements
        document.querySelectorAll('.store-click-area.selected, .store-card.selected')
            .forEach(el => el.classList.remove('selected'));
        
        // Clear previous polygon highlights
        document.querySelectorAll('.store-polygon').forEach(polygon => {
            polygon.setAttribute('fill', 'transparent');
            polygon.setAttribute('stroke', 'transparent');
        });
        
        // Select new store
        const clickArea = document.querySelector(`.store-click-area[data-store-id="${storeId}"]`);
        const storeCard = document.querySelector(`.store-card[data-store-id="${storeId}"]`);
        const polygon = document.querySelector(`.store-polygon[data-store-id="${storeId}"]`);
        
        if (clickArea) {
            clickArea.classList.add('selected');
        }
        
        if (storeCard) {
            storeCard.classList.add('selected');
            storeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Highlight selected polygon
        if (polygon) {
            const store = this.storeData.stores.find(s => s.id === storeId);
            if (store) {
                polygon.setAttribute('fill', store.color);
                polygon.setAttribute('fill-opacity', '0.3');
                polygon.setAttribute('stroke', '#4ecdc4');
                polygon.setAttribute('stroke-width', '3');
            }
        }
        
        // Store selection
        this.selectedStore = this.storeData.stores.find(s => s.id === storeId);
        
        // Scroll map to store if needed
        if (clickArea) {
            clickArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    highlightStore(storeId) {
        const clickArea = document.querySelector(`.store-click-area[data-store-id="${storeId}"]`);
        const storeCard = document.querySelector(`.store-card[data-store-id="${storeId}"]`);
        const polygon = document.querySelector(`.store-polygon[data-store-id="${storeId}"]`);
        
        // Only highlight if not already selected
        if (clickArea && !clickArea.classList.contains('selected')) {
            if (polygon) {
                polygon.setAttribute('fill', '#ff6b6b');
                polygon.setAttribute('fill-opacity', '0.2');
                polygon.setAttribute('stroke', '#ff6b6b');
                polygon.setAttribute('stroke-width', '2');
            }
        }
        
        if (storeCard && !storeCard.classList.contains('selected')) {
            storeCard.style.transform = 'translateX(5px)';
        }
    }
    
    unhighlightStore(storeId) {
        const clickArea = document.querySelector(`.store-click-area[data-store-id="${storeId}"]`);
        const storeCard = document.querySelector(`.store-card[data-store-id="${storeId}"]`);
        const polygon = document.querySelector(`.store-polygon[data-store-id="${storeId}"]`);
        
        // Only unhighlight if not selected
        if (clickArea && !clickArea.classList.contains('selected')) {
            if (polygon) {
                polygon.setAttribute('fill', 'transparent');
                polygon.setAttribute('stroke', 'transparent');
            }
        }
        
        if (storeCard && !storeCard.classList.contains('selected')) {
            storeCard.style.transform = 'translateX(0)';
        }
    }
    
    deselectAllStores() {
        // Clear all selections
        document.querySelectorAll('.store-click-area.selected, .store-card.selected')
            .forEach(el => el.classList.remove('selected'));
        
        // Clear all polygon highlights
        document.querySelectorAll('.store-polygon').forEach(polygon => {
            polygon.setAttribute('fill', 'transparent');
            polygon.setAttribute('stroke', 'transparent');
        });
        
        this.selectedStore = null;
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #ff6b6b; color: white; padding: 20px; border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 1000;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Initialize the interactive map when page loads
document.addEventListener('DOMContentLoaded', () => {
    new InteractiveMallMap();
});