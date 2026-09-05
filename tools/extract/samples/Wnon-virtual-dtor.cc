// FLAGS: -Wnon-virtual-dtor -Weffc++
struct Base {
    virtual void run();
};
struct Derived : Base {
    void run() override;
};
