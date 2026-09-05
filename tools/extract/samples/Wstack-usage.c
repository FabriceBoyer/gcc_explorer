// FLAGS: -Wstack-usage=128 -Wframe-larger-than=128
int big_frame(void) {
    volatile char buf[4096];
    buf[0] = 1;
    return buf[0];
}
