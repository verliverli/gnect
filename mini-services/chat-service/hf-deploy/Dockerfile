FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY index.ts ./

# HuggingFace Spaces uses port 7860
ENV PORT=7860

# Expose the port
EXPOSE 7860

# Start the service
CMD ["bun", "run", "start"]
