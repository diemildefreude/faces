FROM php:8.2-apache

# Install required systems packages and Node.js 20 for Vite asset bundling
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install mysqli PHP extension and enable Apache rewrite module
RUN docker-php-ext-install mysqli && a2enmod rewrite

# Configure Apache to serve directly from the compiled /dist folder
ENV APACHE_DOCUMENT_ROOT /var/www/html/dist

RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Copy project files and build frontend assets
WORKDIR /var/www/html
COPY . .
RUN npm install && npm run build
