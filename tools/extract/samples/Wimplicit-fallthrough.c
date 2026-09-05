// FLAGS: -Wimplicit-fallthrough
int classify(int c) {
    int r = 0;
    switch (c) {
    case 1:
        r = 10;
    case 2:
        r += 20;
        break;
    }
    return r;
}
