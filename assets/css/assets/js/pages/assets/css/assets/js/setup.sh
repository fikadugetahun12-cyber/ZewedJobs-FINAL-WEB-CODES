#!/bin/bash

echo "Setting up JobPortal project..."

# Create directory structure
mkdir -p assets/{images,css,js} pages

# Download images with new links
echo "Downloading images..."
curl -L -o assets/images/hero-bg.jpg "https://gemini.google.com/share/c11c6ba53b67"
curl -L -o assets/images/placeholder.jpg "https://gemini.google.com/share/55a24f651003"
curl -L -o assets/images/economy-graph.png "https://gemini.google.com/share/2ebb9fd98e24"
curl -L -o assets/images/bot-avatar.png "https://gemini.google.com/share/6a035e4f045a"

# Create HTML files
echo "Creating HTML files..."

# Create index.html
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JobPortal - Find Your Dream Career</title>
    <link rel="stylesheet" href="assets/css/styles.css">
    <link rel="icon" type="image/x-icon" href="assets/images/bot-avatar.png">
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar">
        <div class="container">
            <a href="index.html" class="logo">
                <svg width="32" height="32" viewBox="0 0 24 24">
                    <path d="M20 6H16V4C16 2.89 15.11 2 14 2H10C8.89 2 8 2.89 8 4V6H4C2.89 6 2.01 6.89 2.01 8L2 19C2 20.11 2.89 21 4 21H20C21.11 21 22 20.11 22 19V8C22 6.89 21.11 6 20 6ZM10 4H14V6H10V4ZM20 19H4V8H20V19Z"/>
                </svg>
                Job<span>Portal</span>
            </a>
            
            <button class="mobile-menu-btn">☰</button>
            
            <ul class="nav-links">
                <li><a href="index.html" class="active">Home</a></li>
                <li><a href="pages/jobs.html">Jobs</a></li>
                <li><a href="pages/employers.html">Employers</a></li>
                <li><a href="pages/courses.html">Courses</a></li>
                <li><a href="pages/about.html">About</a></li>
            </ul>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
        <div class="container">
            <h1>Find Your Dream Career</h1>
            <p>Connect with top employers, discover exciting opportunities, and develop the skills you need for tomorrow's job market.</p>
            <div class="hero-buttons">
                <a href="pages/jobs.html" class="btn btn-primary">Browse Jobs</a>
                <a href="pages/courses.html" class="btn btn-outline">Explore Courses</a>
            </div>
        </div>
    </section>

    <!-- Stats Section -->
    <section class="section">
        <div class="container">
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number" data-target="10000">10,000+</div>
                    <div class="stat-label">Jobs Available</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" data-target="5000">5,000+</div>
                    <div class="stat-label">Companies Hiring</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" data-target="50000">50,000+</div>
                    <div class="stat-label">Successful Hires</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" data-target="500">500+</div>
                    <div class="stat-label">Career Courses</div>
                </div>
            </div>
        </div>
    </section>

    <script src="assets/js/main.js"></script>
</body>
</html>
EOF

# Make script executable
chmod +x setup.sh

echo "Setup complete! Run ./setup.sh to set up the project."
