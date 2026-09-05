// FLAGS: -Wuninitialized -Wmaybe-uninitialized -O1
int compute(int flag) {
    int value;
    if (flag > 0)
        value = flag * 2;
    return value;
}
