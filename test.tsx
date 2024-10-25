// This is a comment
import React from 'react';

interface Props {
  name: string;
  age: number;
  isActive?: boolean;
}

const colors = {
  primary: '#ff0000',
  secondary: '#00ff00'
};

export class TestComponent extends React.Component<Props> {
  private count: number = 0;
  
  handleClick = () => {
    this.count += 1;
    console.log(`Count is now ${this.count}`);
  }

  render() {
    const { name, age, isActive = false } = this.props;
    
    return (
      <div className="test-component">
        <h1>Hello {name}!</h1>
        <p>You are {age} years old</p>
        {isActive && (
          <button onClick={this.handleClick}>
            Click me
          </button>
        )}
      </div>
    );
  }
}
