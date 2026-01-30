// Main JavaScript for JobPortal Website

// DOM Ready Function
document.addEventListener('DOMContentLoaded', function() {
    
    // ====== MOBILE MENU TOGGLE ======
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            this.textContent = navLinks.classList.contains('active') ? '✕' : '☰';
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.navbar') && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                mobileMenuBtn.textContent = '☰';
            }
        });
    }
    
    // ====== ANIMATED COUNTERS ======
    const statCounters = document.querySelectorAll('.stat-number');
    
    if (statCounters.length > 0) {
        const observerOptions = {
            threshold: 0.5,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const counterObserver = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const counter = entry.target;
                    const target = parseInt(counter.textContent);
                    const duration = 2000; // 2 seconds
                    const step = target / (duration / 16);
                    let current = 0;
                    
                    const timer = setInterval(function() {
                        current += step;
                        if (current >= target) {
                            counter.textContent = target.toLocaleString() + 
                                (counter.textContent.includes('+') ? '+' : '') +
                                (counter.textContent.includes('K') ? 'K' : '');
                            clearInterval(timer);
                        } else {
                            counter.textContent = Math.floor(current).toLocaleString();
                        }
                    }, 16);
                    
                    counterObserver.unobserve(counter);
                }
            });
        }, observerOptions);
        
        statCounters.forEach(counter => counterObserver.observe(counter));
    }
    
    // ====== FORM VALIDATION ======
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const requiredFields = this.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.style.borderColor = '#e74c3c';
                    isValid = false;
                    
                    // Add error message
                    if (!field.nextElementSibling?.classList.contains('error-message')) {
                        const errorMsg = document.createElement('div');
                        errorMsg.className = 'error-message';
                        errorMsg.style.color = '#e74c3c';
                        errorMsg.style.fontSize = '0.85rem';
                        errorMsg.style.marginTop = '0.3rem';
                        errorMsg.textContent = 'This field is required';
                        field.parentNode.appendChild(errorMsg);
                    }
                } else {
                    field.style.borderColor = '#27ae60';
                    const errorMsg = field.parentNode.querySelector('.error-message');
                    if (errorMsg) errorMsg.remove();
                }
            });
            
            if (isValid) {
                // Show loading state
                const submitBtn = this.querySelector('[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Processing...';
                submitBtn.disabled = true;
                
                // Simulate API call
                setTimeout(() => {
                    alert('Form submitted successfully! We will contact you soon.');
                    this.reset();
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }, 1500);
            }
        });
    });
    
    // ====== SEARCH FUNCTIONALITY ======
    const searchBtns = document.querySelectorAll('.search-btn');
    
    searchBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const searchContainer = this.closest('.search-container');
            const searchInputs = searchContainer?.querySelectorAll('.search-input');
            
            if (searchInputs) {
                let searchTerms = [];
                searchInputs.forEach(input => {
                    if (input.value.trim()) {
                        searchTerms.push(input.value);
                    }
                });
                
                if (searchTerms.length > 0) {
                    alert(`Searching for: ${searchTerms.join(', ')}\n\nThis would filter results in a real application.`);
                } else {
                    alert('Please enter search terms');
                }
            }
        });
    });
    
    // ====== CARD INTERACTIONS ======
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
        // Add hover effect
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)';
        });
        
        // Add click handler for action buttons
        const actionBtn = card.querySelector('.btn-primary, .apply-btn, .enroll-btn');
        if (actionBtn && !actionBtn.hasAttribute('data-processed')) {
            actionBtn.setAttribute('data-processed', 'true');
            
            actionBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                
                const cardTitle = card.querySelector('.job-title, .course-title, .employer-name, .pricing-plan');
                const title = cardTitle ? cardTitle.textContent : 'Item';
                
                if (this.classList.contains('apply-btn')) {
                    alert(`Applying for: ${title}\n\nYou will be redirected to the application form.`);
                } else if (this.classList.contains('enroll-btn')) {
                    const price = card.querySelector('.course-price')?.textContent || '$49.99';
                    alert(`Enrolling in: ${title}\nPrice: ${price}\n\nYou will be redirected to checkout.`);
                } else if (this.classList.contains('pricing-btn')) {
                    alert(`Starting subscription for: ${title}\n\nYou will be redirected to payment.`);
                }
            });
        }
    });
    
    // ====== SMOOTH SCROLL ======
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href !== '#' && href.startsWith('#')) {
                e.preventDefault();
                const targetElement = document.querySelector(href);
                
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                    
                    // Close mobile menu if open
                    if (navLinks && navLinks.classList.contains('active')) {
                        navLinks.classList.remove('active');
                        if (mobileMenuBtn) mobileMenuBtn.textContent = '☰';
                    }
                }
            }
        });
    });
    
    // ====== LAZY LOADING IMAGES ======
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        lazyImages.forEach(img => imageObserver.observe(img));
    } else {
        // Fallback for older browsers
        lazyImages.forEach(img => {
            img.src = img.dataset.src;
        });
    }
    
    // ====== BACK TO TOP BUTTON ======
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '↑';
    backToTopBtn.style.position = 'fixed';
    backToTopBtn.style.bottom = '30px';
    backToTopBtn.style.right = '30px';
    backToTopBtn.style.width = '50px';
    backToTopBtn.style.height = '50px';
    backToTopBtn.style.borderRadius = '50%';
    backToTopBtn.style.background = 'var(--primary)';
    backToTopBtn.style.color = 'white';
    backToTopBtn.style.border = 'none';
    backToTopBtn.style.cursor = 'pointer';
    backToTopBtn.style.fontSize = '1.5rem';
    backToTopBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    backToTopBtn.style.transition = 'all 0.3s ease';
    backToTopBtn.style.opacity = '0';
    backToTopBtn.style.pointerEvents = 'none';
    backToTopBtn.style.zIndex = '999';
    
    document.body.appendChild(backToTopBtn);
    
    backToTopBtn.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.1)';
    });
    
    backToTopBtn.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });
    
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopBtn.style.opacity = '1';
            backToTopBtn.style.pointerEvents = 'auto';
        } else {
            backToTopBtn.style.opacity = '0';
            backToTopBtn.style.pointerEvents = 'none';
        }
    });
    
    // ====== ANIMATE ELEMENTS ON SCROLL ======
    const animatedElements = document.querySelectorAll('.card, .stat-card, .feature-card');
    
    const elementObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                elementObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    animatedElements.forEach(el => {
        elementObserver.observe(el);
    });
    
    // ====== CURRENT YEAR IN FOOTER ======
    const yearSpans = document.querySelectorAll('.current-year');
    const currentYear = new Date().getFullYear();
    
    yearSpans.forEach(span => {
        span.textContent = currentYear;
    });
    
    // ====== INITIALIZE TOOLTIPS ======
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(el => {
        el.addEventListener('mouseenter', function(e) {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.dataset.tooltip;
            tooltip.style.position = 'absolute';
            tooltip.style.background = 'rgba(0,0,0,0.8)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '5px 10px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.fontSize = '0.85rem';
            tooltip.style.zIndex = '10000';
            tooltip.style.whiteSpace = 'nowrap';
            
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + window.scrollX + 'px';
            tooltip.style.top = rect.top + window.scrollY - tooltip.offsetHeight - 10 + 'px';
            
            this._tooltip = tooltip;
        });
        
        el.addEventListener('mouseleave', function() {
            if (this._tooltip) {
                this._tooltip.remove();
                this._tooltip = null;
            }
        });
    });
});

// ====== DEBOUNCE FUNCTION ======
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ====== THROTTLE FUNCTION ======
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ====== LOCAL STORAGE UTILITIES ======
const Storage = {
    set: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            return false;
        }
    },
    
    get: function(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return null;
        }
    },
    
    remove: function(key) {
        localStorage.removeItem(key);
    },
    
    clear: function() {
        localStorage.clear();
    }
};

// ====== API SIMULATION ======
const Api = {
    // Simulate API call with delay
    simulateRequest: function(data, delay = 1000) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    data: data,
                    timestamp: new Date().toISOString()
                });
            }, delay);
        });
    },
    
    // Get jobs (simulated)
    getJobs: function(filters = {}) {
        const mockJobs = [
            { id: 1, title: 'Frontend Developer', company: 'TechCorp', salary: '$80k-$100k' },
            { id: 2, title: 'Data Scientist', company: 'DataWorks', salary: '$90k-$120k' },
            { id: 3, title: 'UX Designer', company: 'CreativeStudio', salary: '$70k-$90k' }
        ];
        
        return this.simulateRequest(mockJobs);
    }
};

// Export utilities for use in other scripts
window.JobPortal = {
    Storage,
    Api,
    debounce,
    throttle
};
