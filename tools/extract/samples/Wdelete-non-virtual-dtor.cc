// FLAGS: -Wdelete-non-virtual-dtor
struct Base { virtual void f(); };
void dispose(Base *p) { delete p; }
