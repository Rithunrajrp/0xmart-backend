# Docker Buildx Installation Guide for EC2

This guide helps you install Docker Buildx on Amazon Linux 2/2023 EC2 instances.

## Quick Fix for Your Issue

You're getting `docker-buildx: command not found` because Buildx is not installed. Here's how to fix it:

### Method 1: Install Docker Buildx Plugin (Recommended)

```bash
# 1. Check your Docker version first
docker version

# 2. Create Docker CLI plugins directory
mkdir -p ~/.docker/cli-plugins

# 3. Download the latest Docker Buildx binary
BUILDX_VERSION=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')
echo "Latest Buildx version: v$BUILDX_VERSION"

# For x86_64 (most common)
curl -L "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-amd64" -o ~/.docker/cli-plugins/docker-buildx

# For ARM64 (if using ARM-based EC2 like t4g, m6g)
# curl -L "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-arm64" -o ~/.docker/cli-plugins/docker-buildx

# 4. Make it executable
chmod +x ~/.docker/cli-plugins/docker-buildx

# 5. Verify installation
docker buildx version

# Expected output: github.com/docker/buildx v0.x.x
```

### Method 2: Manual Installation (If Method 1 Fails)

```bash
# Download specific version manually
cd ~/.docker/cli-plugins

# For x86_64
wget https://github.com/docker/buildx/releases/download/v0.12.1/buildx-v0.12.1.linux-amd64 -O docker-buildx

# For ARM64
# wget https://github.com/docker/buildx/releases/download/v0.12.1/buildx-v0.12.1.linux-arm64 -O docker-buildx

# Make executable
chmod +x docker-buildx

# Verify
docker buildx version
```

### Method 3: Reinstall Docker with Buildx Included

If you want the latest Docker with Buildx pre-installed:

```bash
# Remove old Docker
sudo yum remove docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine

# Install Docker from official repository
sudo yum install -y docker

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
# SSH back in

# Verify Docker and Buildx
docker version
docker buildx version
```

## Set Up Buildx Builder

After installation, create and use a builder:

```bash
# Create a new builder instance
docker buildx create --name 0xmart-builder --use

# Bootstrap the builder (download and start)
docker buildx inspect --bootstrap

# Verify builder is running
docker buildx ls

# Expected output:
# NAME/NODE           DRIVER/ENDPOINT             STATUS   BUILDKIT PLATFORMS
# 0xmart-builder *    docker-container
#   0xmart-builder0   unix:///var/run/docker.sock running  vX.X.X   linux/amd64
```

## Build Multi-Platform Images

Now you can build for multiple architectures:

```bash
# Build for AMD64 and ARM64
docker buildx build --platform linux/amd64,linux/arm64 -t 0xmart-backend:latest .

# Build and push to ECR
docker buildx build --platform linux/amd64 -t $ECR_REPO_URI:latest --push .
```

## Troubleshooting

### Issue: Permission Denied

```bash
# Error: permission denied while trying to connect to the Docker daemon socket
sudo usermod -aG docker $USER
exit
# SSH back in
```

### Issue: QEMU Not Found (for multi-platform builds)

```bash
# Install QEMU for cross-platform builds
docker run --privileged --rm tonistiigi/binfmt --install all

# Verify
docker buildx inspect --bootstrap
```

### Issue: Buildx Not Found After Installation

```bash
# Check if file exists
ls -la ~/.docker/cli-plugins/docker-buildx

# Check permissions
chmod +x ~/.docker/cli-plugins/docker-buildx

# Try running directly
~/.docker/cli-plugins/docker-buildx version
```

### Issue: Builder Fails to Start

```bash
# Remove existing builder
docker buildx rm 0xmart-builder

# Create new builder with specific driver
docker buildx create --name 0xmart-builder --driver docker-container --use

# Restart Docker
sudo systemctl restart docker

# Try again
docker buildx inspect --bootstrap
```

## For 0xMart Backend Deployment

Once Buildx is installed, build your backend image:

```bash
# Navigate to backend directory
cd /path/to/0xmart-backend

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push using Buildx
docker buildx build --platform linux/amd64 -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/0xmart-backend:latest --push .

# Or build locally first
docker buildx build --platform linux/amd64 -t 0xmart-backend:latest --load .
docker tag 0xmart-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/0xmart-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/0xmart-backend:latest
```

## Alternative: Use Regular Docker Build

If you don't need multi-platform builds, you can use regular `docker build`:

```bash
# Regular build (works without Buildx)
docker build -t 0xmart-backend:latest .

# Tag for ECR
docker tag 0xmart-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/0xmart-backend:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/0xmart-backend:latest
```

## Verify Everything Works

```bash
# Check Docker
docker --version
docker info

# Check Buildx
docker buildx version
docker buildx ls

# Test build
cd /path/to/0xmart-backend
docker buildx build --platform linux/amd64 -t test:latest .
```

## Complete Setup Script

Copy and paste this entire script:

```bash
#!/bin/bash
set -e

echo "🔧 Installing Docker Buildx..."

# Create plugin directory
mkdir -p ~/.docker/cli-plugins

# Get latest version
BUILDX_VERSION=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')
echo "📦 Downloading Buildx v$BUILDX_VERSION..."

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    BUILDX_ARCH="amd64"
elif [ "$ARCH" = "aarch64" ]; then
    BUILDX_ARCH="arm64"
else
    echo "❌ Unsupported architecture: $ARCH"
    exit 1
fi

# Download
curl -L "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-${BUILDX_ARCH}" -o ~/.docker/cli-plugins/docker-buildx

# Make executable
chmod +x ~/.docker/cli-plugins/docker-buildx

# Verify
echo "✅ Buildx installed:"
docker buildx version

# Create builder
echo "🏗️  Creating builder..."
docker buildx create --name 0xmart-builder --use
docker buildx inspect --bootstrap

echo "✅ Docker Buildx setup complete!"
docker buildx ls
```

Save as `install-buildx.sh`, then run:

```bash
chmod +x install-buildx.sh
./install-buildx.sh
```

---

**Status:** Ready to use
**Last Updated:** 2025-01-25
