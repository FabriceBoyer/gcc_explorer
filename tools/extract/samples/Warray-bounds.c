// FLAGS: -Warray-bounds -O2
int table[4];
int fetch(void) {
    return table[7];
}
