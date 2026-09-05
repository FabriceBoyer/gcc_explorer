// FLAGS: -Wnull-dereference -O2
int deref(int *p) {
    if (p == 0)
        return *p;
    return *p + 1;
}
