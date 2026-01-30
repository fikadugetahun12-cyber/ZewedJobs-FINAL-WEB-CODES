// Logo Preloading
function preloadLogos() {
    const logoUrls = [
        'assets/images/logos/logo-192.png',
        'assets/images/logos/logo-512.png',
        'assets/images/logos/favicon.png',
        'assets/images/logos/telebirr.png',
        'assets/images/logos/cbe.png',
        'assets/images/logos/paypal.png',
        'assets/images/logos/visa-mastercard.png'
    ];
    
    logoUrls.forEach(url => {
        const img = new Image();
        img.src = url;
    });
}

// Initialize logos on page load
document.addEventListener('DOMContentLoaded', function() {
    preloadLogos();
    
    // Update logo attributes for better SEO
    document.querySelectorAll('.logo-image').forEach(logo => {
        logo.setAttribute('alt', 'JobPortal Logo');
        logo.setAttribute('loading', 'eager');
    });
    
    // Add lazy loading to payment logos
    const paymentLogos = document.querySelectorAll('.payment-logo, .bank-logo');
    paymentLogos.forEach(logo => {
        logo.setAttribute('loading', 'lazy');
    });
    
    // Logo fallback handler
    document.querySelectorAll('img[data-logo]').forEach(img => {
        img.addEventListener('error', function() {
            console.warn(`Logo failed to load: ${this.src}`);
            const logoType = this.getAttribute('data-logo');
            
            // Fallback to generic logo
            switch(logoType) {
                case 'payment':
                    this.src = 'assets/images/logos/visa-mastercard.png';
                    break;
                case 'bank':
                    this.src = 'assets/images/logos/cbe.png';
                    break;
                default:
                    this.src = 'assets/images/logos/logo-192.png';
            }
            
            this.style.opacity = '0.5';
        });
    });
});

// Logo Animation
function animateLogo(logoElement) {
    logoElement.style.transition = 'all 0.5s ease';
    logoElement.style.transform = 'scale(1.1) rotate(5deg)';
    
    setTimeout(() => {
        logoElement.style.transform = 'scale(1) rotate(0deg)';
    }, 300);
}

// Export logo utilities
window.JobPortalLogos = {
    preloadLogos,
    animateLogo
};
