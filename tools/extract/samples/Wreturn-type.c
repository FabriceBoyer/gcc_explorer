// FLAGS: -Wreturn-type
int missing(int n) {
    if (n > 0)
        return n;
}
