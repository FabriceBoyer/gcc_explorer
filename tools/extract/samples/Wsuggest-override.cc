// FLAGS: -Wsuggest-override -Woverloaded-virtual
struct Base {
    virtual ~Base() {}
    virtual void run();
    virtual void run(int);
};
struct Derived : Base {
    void run();
};
