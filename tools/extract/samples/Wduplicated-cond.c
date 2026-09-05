// FLAGS: -Wduplicated-cond -Wduplicated-branches
int pick(int n) {
    if (n == 1)
        return 10;
    else if (n == 1)
        return 20;
    return 0;
}
