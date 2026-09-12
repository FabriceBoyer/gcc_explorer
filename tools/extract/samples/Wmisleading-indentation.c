// FLAGS: -Wall -Wmisleading-indentation
int f(int x) {
  if (x)
    x++;
    return x;
}
