// FLAGS: -Wshadow
int count = 0;

int tally(int n) {
    int count = n;   /* shadows the global */
    return count;
}
