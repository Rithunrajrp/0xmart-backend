#!/bin/bash
# Alternative build script for Solana program without cargo-build-sbf

echo "Building Solana program using standard Rust toolchain..."
echo ""

# Add BPF target if not already added
rustup target add bpfel-unknown-unknown 2>/dev/null || true

# Build for BPF target
cargo build --target bpfel-unknown-unknown --release

# Check if build succeeded
if [ -f "target/bpfel-unknown-unknown/release/oxmart_payment.so" ]; then
    echo ""
    echo "✓ Build successful!"
    echo "Program location: target/bpfel-unknown-unknown/release/oxmart_payment.so"
    echo ""
    echo "To deploy:"
    echo "solana program deploy target/bpfel-unknown-unknown/release/oxmart_payment.so"
else
    echo ""
    echo "Build output not found. Checking standard release..."
    if [ -f "target/bpfel-unknown-unknown/release/liboxmart_payment.so" ]; then
        cp target/bpfel-unknown-unknown/release/liboxmart_payment.so target/bpfel-unknown-unknown/release/oxmart_payment.so
        echo "✓ Build successful!"
        echo "Program location: target/bpfel-unknown-unknown/release/oxmart_payment.so"
    fi
fi
