type CartEventListener = () => void;

class CartEventEmitter {
  private listeners: CartEventListener[] = [];

  subscribe(listener: CartEventListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const cartEvents = new CartEventEmitter();
