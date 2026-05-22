type CartEventListener = () => void;

class CartEventEmitter {
  private listeners: CartEventListener[] = [];
  lastInvalidatedAt = 0;

  subscribe(listener: CartEventListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit() {
    this.lastInvalidatedAt = Date.now();
    this.listeners.forEach((listener) => listener());
  }
}

export const cartEvents = new CartEventEmitter();
