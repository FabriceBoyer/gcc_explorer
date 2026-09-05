// FLAGS: -Wstrict-overflow=5 -O2
int grows(int i) {
    return i + 1 > i;
}
