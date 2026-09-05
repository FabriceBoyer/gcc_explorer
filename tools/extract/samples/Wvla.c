// FLAGS: -Wvla -Wvla-larger-than=16
int sum(int n) {
    int buf[n];
    buf[0] = 0;
    return buf[0];
}
