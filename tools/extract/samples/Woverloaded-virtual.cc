// FLAGS: -Woverloaded-virtual
struct Base { virtual void f(int); };
struct Derived : Base { void f(double); };
