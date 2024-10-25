// Test file to verify VSCode syntax highlighting

// Keywords and control flow
import React, { useState, useEffect } from 'react';
const test = true;
if (test) {
  console.log('Testing');
}

// Types and interfaces
interface User {
  id: number;
  name: string;
  isActive: boolean;
}

type UserRole = 'admin' | 'user' | 'guest';

// Class definition
class UserManager {
  private users: User[] = [];

  constructor() {
    this.users = [];
  }

  // Method with parameters
  public addUser(user: User): void {
    this.users.push(user);
  }
}

// Function with string template
function formatUser(user: User): string {
  return `User ${user.name} (ID: ${user.id})`;
}

// React component with hooks
export function TestComponent() {
  const [count, setCount] = useState(0);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Comments should be green
    const manager = new UserManager();
    manager.addUser({
      id: 1,
      name: "Test User",
      isActive: true
    });
  }, []);

  // JSX with attributes
  return (
    <div className="test-component">
      <h1>Test Component</h1>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
      {user && <p>{formatUser(user)}</p>}
    </div>
  );
}

// Regular expressions
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const testEmail = "test@example.com";
const isValidEmail = emailRegex.test(testEmail);

// Object with different value types
const config = {
  apiUrl: 'https://api.example.com',
  maxRetries: 3,
  timeout: 5000,
  features: {
    darkMode: true,
    notifications: false
  }
};

export default TestComponent;
