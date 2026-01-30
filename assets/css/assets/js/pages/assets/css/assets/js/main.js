// Image Preloading Function
function preloadImages(imageUrls) {
    imageUrls.forEach(url => {
        const img = new Image();
        img.src = url;
    });
}

// Preload important images when page loads
document.addEventListener('DOMContentLoaded', function() {
    const imagesToPreload = [
        'assets/images/hero-bg.jpg',
        'assets/images/placeholder.jpg',
        'assets/images/bot-avatar.png',
        'assets/images/economy-graph.png'
    ];
    
    preloadImages(imagesToPreload);
    
    // Lazy loading for images
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('fade-in');
                    observer.unobserve(img);
                }
            });
        });
        
        lazyImages.forEach(img => imageObserver.observe(img));
    }
    
    // Image error handling
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', function() {
            console.error(`Failed to load image: ${this.src}`);
            this.style.display = 'none';
            
            // Try loading from backup source
            if (this.dataset.fallback) {
                this.src = this.dataset.fallback;
                this.style.display = 'block';
            }
        });
    });
});

// Image Gallery Functionality (if needed)
function initImageGallery() {
    const galleryImages = document.querySelectorAll('.gallery-image');
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <img src="" alt="">
            <button class="lightbox-close">&times;</button>
            <button class="lightbox-prev">&larr;</button>
            <button class="lightbox-next">&rarr;</button>
        </div>
    `;
    document.body.appendChild(lightbox);
    
    let currentIndex = 0;
    
    galleryImages.forEach((img, index) => {
        img.addEventListener('click', () => {
            currentIndex = index;
            openLightbox(img.src, img.alt);
        });
    });
    
    function openLightbox(src, alt) {
        const lightboxImg = lightbox.querySelector('img');
        lightboxImg.src = src;
        lightboxImg.alt = alt;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    
    // Navigation
    lightbox.querySelector('.lightbox-prev').addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
        const img = galleryImages[currentIndex];
        openLightbox(img.src, img.alt);
    });
    
    lightbox.querySelector('.lightbox-next').addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % galleryImages.length;
        const img = galleryImages[currentIndex];
        openLightbox(img.src, img.alt);
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') lightbox.querySelector('.lightbox-prev').click();
        if (e.key === 'ArrowRight') lightbox.querySelector('.lightbox-next').click();
    });
}

// Add to window object for easy access
window.JobPortalImages = {
    preloadImages,
    initImageGallery
};
