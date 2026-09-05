// FLAGS: -Wshift-overflow=2 -Wshift-count-overflow
int shifted(void) {
    return 1 << 40;
}
