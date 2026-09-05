// FLAGS: -Wjump-misses-init
int leap(int n) {
    if (n) goto done;
    int local = 3;
    return local;
done:
    return 0;
}
