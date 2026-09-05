// FLAGS: -Wconversion -Wsign-conversion
unsigned char narrow(int wide) {
    return wide;
}
unsigned to_unsigned(int i) {
    return i;
}
